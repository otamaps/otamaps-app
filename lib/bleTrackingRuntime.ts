import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoSubscription } from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";
import {
  BleManager,
  Device,
  ScanMode,
  State as BleState,
  Subscription,
} from "react-native-ble-plx";
import { BLELocationService } from "./bleLocationService";
import {
  getBlePermissionSnapshot,
  hasBleTrackingPermissions,
} from "./blePermissions";
import {
  BeaconSelectionEngine,
  createLocationFix,
  getLocationUploadReason,
  latestLocationFix,
  parseBeaconAdvertisement,
  pruneStaleObservations,
  smoothBeaconObservation,
} from "./bleTrackingCore";
import {
  BLE_HEARTBEAT_MS,
  BLE_MOVEMENT_UPLOAD_MIN_INTERVAL_MS,
  BeaconObservation,
  BleTrackingSnapshot,
  LocationFix,
  OTAMAPS_SERVICE_UUID,
  PositionEstimate,
  StartTrackingResult,
  TrackingDiagnostics,
  TrackingRuntimeMode,
} from "./bleTrackingTypes";
import { supabase } from "./supabase";

export const BLE_BACKGROUND_CONSENT_KEY = "ble_background_consent_v1";
const BLE_SNAPSHOT_KEY = "ble_tracking_snapshot_v1";
const BLE_PENDING_FIX_KEY = "ble_pending_location_fix_v1";
const SNAPSHOT_PERSIST_THROTTLE_MS = 2_000;
const FAILED_UPLOAD_RETRY_MS = 30_000;

const initialDiagnostics: TrackingDiagnostics = {
  mode: "stopped",
  status: "stopped",
  consent: false,
  bluetoothState: "Unknown",
  permissions: {},
  serviceStartedAt: null,
  lastScanAt: null,
  lastBeaconId: null,
  lastBeaconRssi: null,
  selectedBeaconId: null,
  estimationMethod: null,
  contributingBeaconCount: 0,
  lastEstimateAt: null,
  lastUploadAttemptAt: null,
  lastUploadSuccessAt: null,
  lastUploadReason: null,
  pendingUpload: false,
  lastError: null,
};

let snapshot: BleTrackingSnapshot = {
  diagnostics: { ...initialDiagnostics },
  beacons: [],
  currentRoom: null,
  coordinates: null,
  floor: null,
  radius: 50,
  lastUpdated: 0,
};

let manager: BleManager | null = null;
let stateSubscription: Subscription | null = null;
let scanActive = false;
let runtimeTimer: ReturnType<typeof setInterval> | null = null;
let currentMode: TrackingRuntimeMode = "stopped";
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let pendingFix: LocationFix | null = null;
let queuedFix: LocationFix | null = null;
let uploadInFlight = false;
let trackingGeneration = 0;
let discardPendingAfterStop = false;
let lastPersistedAt = 0;
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
let persistenceChain = Promise.resolve();
let networkSubscription: NetInfoSubscription | null = null;
let networkConnected: boolean | null = null;
let retryAfter = 0;
let lastUploadedCoordinates: [number, number] | null = null;
let lastAutomaticUploadScheduledAt = 0;
const observations = new Map<string, BeaconObservation>();
const selection = new BeaconSelectionEngine();
const listeners = new Set<(value: BleTrackingSnapshot) => void>();

function sanitizeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === "string") return error.slice(0, 240);
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.slice(0, 240);
  }
  return "Unknown BLE tracking error";
}

function cloneSnapshot(): BleTrackingSnapshot {
  return {
    ...snapshot,
    diagnostics: {
      ...snapshot.diagnostics,
      permissions: { ...snapshot.diagnostics.permissions },
    },
    beacons: snapshot.beacons.map((beacon) => ({ ...beacon })),
    coordinates: snapshot.coordinates ? [...snapshot.coordinates] : null,
  };
}

function queueSnapshotPersistence(immediate = false): void {
  const persist = () => {
    persistenceTimer = null;
    lastPersistedAt = Date.now();
    const value = JSON.stringify(snapshot);
    persistenceChain = persistenceChain
      .then(() => AsyncStorage.setItem(BLE_SNAPSHOT_KEY, value))
      .catch((error) => console.warn("BLE snapshot persistence failed", error));
  };

  if (immediate || Date.now() - lastPersistedAt >= SNAPSHOT_PERSIST_THROTTLE_MS) {
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persist();
  } else if (!persistenceTimer) {
    persistenceTimer = setTimeout(
      persist,
      SNAPSHOT_PERSIST_THROTTLE_MS - (Date.now() - lastPersistedAt)
    );
  }
}

function emitSnapshot(immediate = false): void {
  snapshot = {
    ...snapshot,
    beacons: pruneStaleObservations(observations.values()),
    lastUpdated: Date.now(),
  };
  const value = cloneSnapshot();
  for (const listener of listeners) listener(value);
  queueSnapshotPersistence(immediate);
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const [snapshotRaw, pendingRaw, consentRaw] = await Promise.all([
        AsyncStorage.getItem(BLE_SNAPSHOT_KEY),
        AsyncStorage.getItem(BLE_PENDING_FIX_KEY),
        AsyncStorage.getItem(BLE_BACKGROUND_CONSENT_KEY),
      ]);
      if (snapshotRaw) {
        const stored = JSON.parse(snapshotRaw) as BleTrackingSnapshot;
        if (stored?.diagnostics) {
          snapshot = {
            ...snapshot,
            ...stored,
            diagnostics: {
              ...initialDiagnostics,
              ...stored.diagnostics,
              mode: "stopped",
              status: "stopped",
              consent: consentRaw === "true",
            },
          };
        }
      } else {
        snapshot.diagnostics.consent = consentRaw === "true";
      }
      if (pendingRaw) {
        pendingFix = JSON.parse(pendingRaw) as LocationFix;
        snapshot.diagnostics.pendingUpload = true;
      }
    } catch (error) {
      snapshot.diagnostics.lastError = sanitizeError(error);
    } finally {
      hydrated = true;
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

export async function getBackgroundTrackingConsent(): Promise<boolean> {
  await hydrate();
  return snapshot.diagnostics.consent;
}

export async function setBackgroundTrackingConsent(
  enabled: boolean
): Promise<void> {
  await hydrate();
  snapshot.diagnostics.consent = enabled;
  await AsyncStorage.setItem(
    BLE_BACKGROUND_CONSENT_KEY,
    enabled ? "true" : "false"
  );
  emitSnapshot(true);
}

async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

function ensureManager(): BleManager {
  if (manager) return manager;
  manager =
    Platform.OS === "ios"
      ? new BleManager({
          restoreStateIdentifier: "otamaps-ble-central-v1",
          restoreStateFunction: (restoredState) => {
            if (restoredState) {
              void resumeIOSRestoredTracking();
            }
          },
        })
      : new BleManager();
  return manager;
}

async function resumeIOSRestoredTracking(): Promise<void> {
  await hydrate();
  if (
    Platform.OS !== "ios" ||
    !snapshot.diagnostics.consent ||
    !(await hasSession())
  ) {
    return;
  }
  await startTrackingRuntime("ios-background");
}

export async function initializeIOSStateRestoration(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await hydrate();
  if (snapshot.diagnostics.consent) ensureManager();
}

function startScan(): void {
  if (!manager || scanActive || currentMode === "stopped") return;
  scanActive = true;
  snapshot.diagnostics.status = "scanning";
  snapshot.diagnostics.lastError = null;
  emitSnapshot(true);

  const serviceUUIDs = Platform.OS === "ios" ? [OTAMAPS_SERVICE_UUID] : null;
  manager.startDeviceScan(
    serviceUUIDs,
    {
      allowDuplicates: true,
      ...(Platform.OS === "android" ? { scanMode: ScanMode.Balanced } : {}),
    },
    (error, device) => {
      if (error) {
        scanActive = false;
        snapshot.diagnostics.status = "error";
        snapshot.diagnostics.lastError = sanitizeError(error);
        emitSnapshot(true);
        return;
      }
      if (device) handleDevice(device);
    }
  );
}

function handleBluetoothState(state: BleState): void {
  snapshot.diagnostics.bluetoothState = state;
  if (state === BleState.PoweredOn && currentMode !== "stopped") {
    snapshot.diagnostics.status = "starting";
    emitSnapshot();
    startScan();
    return;
  }

  if (state === BleState.PoweredOff) {
    scanActive = false;
    snapshot.diagnostics.status = "blocked";
    snapshot.diagnostics.lastError = "bluetooth_off";
  } else if (state === BleState.Unauthorized) {
    scanActive = false;
    snapshot.diagnostics.status = "blocked";
    snapshot.diagnostics.lastError = "permission_denied";
  }
  emitSnapshot(true);
}

function applyPositionEstimate(
  estimate: PositionEstimate,
  observedAt: number
): void {
  snapshot.coordinates = [...estimate.coordinates];
  snapshot.floor = estimate.floor
    ? Number.parseInt(estimate.floor, 10)
    : null;
  snapshot.radius = estimate.radius;
  snapshot.diagnostics.estimationMethod = estimate.method;
  snapshot.diagnostics.contributingBeaconCount =
    estimate.contributorIds.length;
  snapshot.diagnostics.lastEstimateAt = observedAt;
}

function scheduleAutomaticUpload(
  selectedBeaconId: string,
  active: BeaconObservation[],
  selectedChanged: boolean,
  now: number,
  estimate: PositionEstimate | null = null
): void {
  const reason = getLocationUploadReason({
    selectedChanged,
    lastUploadSuccessAt: snapshot.diagnostics.lastUploadSuccessAt,
    now,
    estimatedCoordinates: estimate?.coordinates,
    lastUploadedCoordinates,
  });
  if (!reason) return;
  if (
    !selectedChanged &&
    (uploadInFlight || queuedFix || pendingFix) &&
    now - lastAutomaticUploadScheduledAt <
      BLE_MOVEMENT_UPLOAD_MIN_INTERVAL_MS
  ) {
    return;
  }
  lastAutomaticUploadScheduledAt = now;
  scheduleUpload(createLocationFix(selectedBeaconId, active, now, reason));
}

function handleDevice(device: Device): void {
  const observation = parseBeaconAdvertisement({
    name: device.name,
    localName: device.localName,
    serviceUUIDs: device.serviceUUIDs,
    serviceData: device.serviceData,
    manufacturerData: device.manufacturerData,
    rssi: device.rssi,
  });
  if (!observation) return;

  const smoothedObservation = smoothBeaconObservation(
    observations.get(observation.id),
    observation
  );
  observations.set(observation.id, smoothedObservation);
  snapshot.diagnostics.lastScanAt = observation.seenAt;
  snapshot.diagnostics.lastBeaconId = observation.id;
  snapshot.diagnostics.lastBeaconRssi = observation.rssi;

  const active = pruneStaleObservations(observations.values(), observation.seenAt);
  const result = selection.select(active, observation.seenAt);
  snapshot.diagnostics.selectedBeaconId = result.selectedBeaconId;
  emitSnapshot(result.changed);

  if (result.selectedBeaconId && result.changed) {
    scheduleAutomaticUpload(
      result.selectedBeaconId,
      active,
      true,
      observation.seenAt
    );
  }
}

function runtimeTick(): void {
  const now = Date.now();
  const active = pruneStaleObservations(observations.values(), now);
  const activeIds = new Set(active.map((item) => item.id));
  for (const id of observations.keys()) {
    if (!activeIds.has(id)) observations.delete(id);
  }

  const result = selection.select(active, now);
  snapshot.diagnostics.selectedBeaconId = result.selectedBeaconId;
  if (!result.selectedBeaconId) {
    // Preserve the last uploaded location locally and in the database. The
    // cleared selectedBeaconId and aging upload timestamp communicate that the
    // location is now only a last-seen value, and heartbeats stop here.
    emitSnapshot(result.changed);
    return;
  }

  const fix = createLocationFix(result.selectedBeaconId, active, now);
  const estimate = BLELocationService.estimateLocationFixLocally(fix);
  if (estimate) applyPositionEstimate(estimate, now);
  emitSnapshot(result.changed);
  scheduleAutomaticUpload(
    result.selectedBeaconId,
    active,
    result.changed,
    now,
    estimate
  );
}

function scheduleUpload(fix: LocationFix): void {
  if (currentMode === "stopped") return;
  queuedFix = latestLocationFix(queuedFix, fix);
  if (networkConnected === false || Date.now() < retryAfter) {
    const latest = latestLocationFix(pendingFix, queuedFix);
    queuedFix = null;
    if (latest) void persistPendingFix(latest);
    return;
  }
  if (!uploadInFlight) void drainUploadQueue();
}

async function persistPendingFix(fix: LocationFix): Promise<void> {
  pendingFix = latestLocationFix(pendingFix, fix);
  if (!pendingFix) return;
  snapshot.diagnostics.pendingUpload = true;
  await AsyncStorage.setItem(BLE_PENDING_FIX_KEY, JSON.stringify(pendingFix));
  emitSnapshot(true);
}

async function drainUploadQueue(): Promise<void> {
  if (uploadInFlight) return;
  uploadInFlight = true;
  try {
    while (queuedFix || pendingFix) {
      const fix = latestLocationFix(queuedFix, pendingFix);
      queuedFix = null;
      pendingFix = null;
      if (!fix) break;

      if (networkConnected === false || Date.now() < retryAfter) {
        await persistPendingFix(fix);
        break;
      }

      snapshot.diagnostics.lastUploadAttemptAt = Date.now();
      emitSnapshot();
      const uploadGeneration = trackingGeneration;
      const result = await BLELocationService.updateLocationFix(fix);
      if (uploadGeneration !== trackingGeneration || currentMode === "stopped") {
        queuedFix = null;
        if (discardPendingAfterStop) {
          pendingFix = null;
        } else {
          pendingFix = fix;
          await AsyncStorage.setItem(BLE_PENDING_FIX_KEY, JSON.stringify(fix));
        }
        break;
      }
      if (!result.success) {
        retryAfter = Date.now() + FAILED_UPLOAD_RETRY_MS;
        pendingFix = latestLocationFix(queuedFix, fix);
        queuedFix = null;
        snapshot.diagnostics.lastError = result.error ?? "upload_failed";
        if (pendingFix) await persistPendingFix(pendingFix);
        break;
      }

      retryAfter = 0;
      pendingFix = null;
      await AsyncStorage.removeItem(BLE_PENDING_FIX_KEY);
      snapshot.diagnostics.pendingUpload = false;
      snapshot.diagnostics.lastUploadSuccessAt = Date.now();
      snapshot.diagnostics.lastUploadReason = fix.uploadReason ?? "retry";
      snapshot.diagnostics.lastError = null;
      snapshot.currentRoom = result.currentRoom ?? null;
      if (result.estimate) {
        applyPositionEstimate(result.estimate, fix.observedAt);
      } else {
        snapshot.coordinates = result.coordinates ?? null;
        snapshot.floor = result.floor
          ? Number.parseInt(result.floor, 10)
          : null;
        snapshot.radius = result.radius ?? 50;
      }
      lastUploadedCoordinates = result.coordinates
        ? [...result.coordinates]
        : null;
      emitSnapshot(true);
    }
  } finally {
    uploadInFlight = false;
    if (queuedFix) void drainUploadQueue();
  }
}

export async function startTrackingRuntime(
  mode: Exclude<TrackingRuntimeMode, "stopped">
): Promise<StartTrackingResult> {
  await hydrate();
  const background = mode !== "foreground";
  if (background && !snapshot.diagnostics.consent) {
    snapshot.diagnostics.status = "blocked";
    snapshot.diagnostics.lastError = "consent_required";
    emitSnapshot(true);
    return { success: false, reason: "consent_required" };
  }
  if (!(await hasSession())) {
    snapshot.diagnostics.status = "blocked";
    snapshot.diagnostics.lastError = "signed_out";
    emitSnapshot(true);
    return { success: false, reason: "signed_out" };
  }
  if (!(await hasBleTrackingPermissions(background))) {
    snapshot.diagnostics.status = "blocked";
    snapshot.diagnostics.lastError = "permission_denied";
    snapshot.diagnostics.permissions = await getBlePermissionSnapshot();
    emitSnapshot(true);
    return { success: false, reason: "permission_denied" };
  }

  if (
    currentMode === mode &&
    manager &&
    (snapshot.diagnostics.status === "starting" ||
      snapshot.diagnostics.status === "scanning")
  ) {
    return { success: true };
  }

  currentMode = mode;
  trackingGeneration += 1;
  discardPendingAfterStop = false;
  snapshot.diagnostics.mode = mode;
  snapshot.diagnostics.status = "starting";
  snapshot.diagnostics.serviceStartedAt ??= Date.now();
  snapshot.diagnostics.permissions = await getBlePermissionSnapshot();
  emitSnapshot(true);

  // Hydrate the local catalog before scanning. A stale or empty catalog starts
  // one background refresh, but scan callbacks and runtime ticks remain local.
  await BLELocationService.prepareBeaconCatalog();

  const bleManager = ensureManager();
  networkSubscription?.();
  networkSubscription = NetInfo.addEventListener((state) => {
    const wasConnected = networkConnected;
    networkConnected =
      state.isConnected !== false && state.isInternetReachable !== false;
    if (networkConnected && wasConnected === false) {
      retryAfter = 0;
      if (pendingFix && currentMode !== "stopped") scheduleUpload(pendingFix);
    }
  });
  stateSubscription?.remove();
  stateSubscription = bleManager.onStateChange(handleBluetoothState, true);
  const state = await bleManager.state();
  handleBluetoothState(state);

  if (!runtimeTimer) {
    runtimeTimer = setInterval(runtimeTick, 5_000);
  }
  if (pendingFix) scheduleUpload(pendingFix);

  if (state === BleState.PoweredOff) {
    return { success: false, reason: "bluetooth_off" };
  }
  if (state === BleState.Unauthorized) {
    return { success: false, reason: "permission_denied" };
  }
  return { success: true };
}

async function stopRuntime(clearPending: boolean): Promise<void> {
  trackingGeneration += 1;
  discardPendingAfterStop = clearPending;
  if (runtimeTimer) {
    clearInterval(runtimeTimer);
    runtimeTimer = null;
  }
  stateSubscription?.remove();
  stateSubscription = null;
  networkSubscription?.();
  networkSubscription = null;
  networkConnected = null;
  retryAfter = 0;
  if (manager) {
    if (scanActive) manager.stopDeviceScan();
    manager.destroy();
    manager = null;
  }
  scanActive = false;
  currentMode = "stopped";
  observations.clear();
  selection.reset();
  queuedFix = null;
  snapshot = {
    ...snapshot,
    currentRoom: clearPending ? null : snapshot.currentRoom,
    coordinates: clearPending ? null : snapshot.coordinates,
    floor: clearPending ? null : snapshot.floor,
    beacons: [],
    diagnostics: {
      ...snapshot.diagnostics,
      mode: "stopped",
      status: "stopped",
      serviceStartedAt: null,
      selectedBeaconId: null,
      lastBeaconId: null,
      lastBeaconRssi: null,
      estimationMethod: clearPending
        ? null
        : snapshot.diagnostics.estimationMethod,
      contributingBeaconCount: clearPending
        ? 0
        : snapshot.diagnostics.contributingBeaconCount,
      lastEstimateAt: clearPending
        ? null
        : snapshot.diagnostics.lastEstimateAt,
      lastError: null,
    },
  };
  if (clearPending) {
    lastUploadedCoordinates = null;
    lastAutomaticUploadScheduledAt = 0;
    pendingFix = null;
    snapshot.diagnostics.pendingUpload = false;
    await AsyncStorage.removeItem(BLE_PENDING_FIX_KEY);
  }
  emitSnapshot(true);
}

export async function startForegroundTracking(): Promise<StartTrackingResult> {
  if (currentMode === "android-background" || currentMode === "ios-background") {
    return { success: true };
  }
  return startTrackingRuntime("foreground");
}

export async function stopForegroundTracking(): Promise<void> {
  if (currentMode === "foreground") await stopRuntime(false);
}

export async function stopAllTracking(clearPending = false): Promise<void> {
  await stopRuntime(clearPending);
}

export async function handleTrackingAppState(
  backgroundEnabled: boolean
): Promise<void> {
  if (AppState.currentState === "active") {
    if (!backgroundEnabled) await startForegroundTracking();
  } else if (!backgroundEnabled) {
    await stopForegroundTracking();
  }
}

export function getTrackingSnapshot(): BleTrackingSnapshot {
  return cloneSnapshot();
}

export async function hydrateTrackingSnapshot(): Promise<BleTrackingSnapshot> {
  await hydrate();
  return getTrackingSnapshot();
}

export function subscribeToTrackingSnapshot(
  listener: (value: BleTrackingSnapshot) => void
): () => void {
  listeners.add(listener);
  listener(getTrackingSnapshot());
  return () => listeners.delete(listener);
}

export async function forceUploadCurrentLocation(): Promise<boolean> {
  const active = pruneStaleObservations(observations.values());
  const selectedBeaconId = selection.getSelectedBeaconId();
  if (!selectedBeaconId || active.length === 0) return false;
  scheduleUpload(
    createLocationFix(selectedBeaconId, active, Date.now(), "manual")
  );
  return true;
}

export function getHeartbeatIntervalMs(): number {
  return BLE_HEARTBEAT_MS;
}
