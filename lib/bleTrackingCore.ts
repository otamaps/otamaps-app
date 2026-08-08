import { Buffer } from "buffer";
import {
  BLE_BEACON_STALE_MS,
  BLE_HEARTBEAT_MS,
  BLE_MOVEMENT_UPLOAD_METERS,
  BLE_MOVEMENT_UPLOAD_MIN_INTERVAL_MS,
  BLE_RSSI_THRESHOLD,
  BeaconAdvertisement,
  BeaconObservation,
  LocationFix,
  LocationUploadReason,
  OTAMAPS_SERVICE_UUID,
} from "./bleTrackingTypes";
import { distanceBetweenCoordinatesMeters } from "./blePositionEstimator";

const SWITCH_MARGIN_DB = 6;
const SWITCH_CONSECUTIVE_READINGS = 3;
const MAX_BEACON_ID_LENGTH = 64;
const RSSI_EMA_ALPHA = 0.25;

function findServiceData(
  serviceData: Record<string, string> | null | undefined
): string | null {
  if (!serviceData) return null;
  const key = Object.keys(serviceData).find(
    (uuid) => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
  );
  return key ? serviceData[key] : null;
}

function decodeBeaconId(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64")
      .toString("utf8")
      .replace(/\0+$/g, "")
      .trim();
    if (
      !decoded ||
      decoded.toLowerCase() === "none" ||
      decoded.length > MAX_BEACON_ID_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function parseBeaconAdvertisement(
  advertisement: BeaconAdvertisement,
  seenAt = Date.now()
): BeaconObservation | null {
  if (
    advertisement.rssi == null ||
    advertisement.rssi < BLE_RSSI_THRESHOLD
  ) {
    return null;
  }

  const hasServiceUuid =
    advertisement.serviceUUIDs?.some(
      (uuid) => uuid.toLowerCase() === OTAMAPS_SERVICE_UUID.toLowerCase()
    ) ?? false;
  const encodedServiceData = findServiceData(advertisement.serviceData);

  // Device names are intentionally advisory. iOS may omit them from
  // advertisements delivered while the app is in the background.
  if (!hasServiceUuid && !encodedServiceData) return null;

  const id =
    decodeBeaconId(encodedServiceData) ??
    decodeBeaconId(advertisement.manufacturerData);
  if (!id) return null;

  return { id, rssi: advertisement.rssi, seenAt };
}

export function pruneStaleObservations(
  observations: Iterable<BeaconObservation>,
  now = Date.now(),
  staleAfterMs = BLE_BEACON_STALE_MS
): BeaconObservation[] {
  return Array.from(observations).filter(
    (observation) => now - observation.seenAt <= staleAfterMs
  );
}

export function smoothBeaconObservation(
  previous: BeaconObservation | null | undefined,
  next: BeaconObservation,
  alpha = RSSI_EMA_ALPHA
): BeaconObservation {
  if (
    !previous ||
    next.seenAt - previous.seenAt > BLE_BEACON_STALE_MS ||
    !Number.isFinite(previous.rssi) ||
    alpha <= 0 ||
    alpha >= 1
  ) {
    return next;
  }
  return {
    ...next,
    rssi: previous.rssi + alpha * (next.rssi - previous.rssi),
  };
}

export interface SelectionResult {
  selectedBeaconId: string | null;
  changed: boolean;
}

export class BeaconSelectionEngine {
  private selectedBeaconId: string | null = null;
  private candidateBeaconId: string | null = null;
  private candidateCount = 0;

  reset(): void {
    this.selectedBeaconId = null;
    this.candidateBeaconId = null;
    this.candidateCount = 0;
  }

  getSelectedBeaconId(): string | null {
    return this.selectedBeaconId;
  }

  select(
    observations: BeaconObservation[],
    now = Date.now()
  ): SelectionResult {
    const active = pruneStaleObservations(observations, now).sort(
      (a, b) => b.rssi - a.rssi
    );
    const strongest = active[0] ?? null;
    const previous = this.selectedBeaconId;

    if (!strongest) {
      this.reset();
      return { selectedBeaconId: null, changed: previous !== null };
    }

    const selected = this.selectedBeaconId
      ? active.find((item) => item.id === this.selectedBeaconId)
      : null;

    if (!selected) {
      this.selectedBeaconId = strongest.id;
      this.candidateBeaconId = null;
      this.candidateCount = 0;
      return {
        selectedBeaconId: strongest.id,
        changed: previous !== strongest.id,
      };
    }

    if (selected.id === strongest.id) {
      this.candidateBeaconId = null;
      this.candidateCount = 0;
      return { selectedBeaconId: selected.id, changed: false };
    }

    if (strongest.rssi - selected.rssi >= SWITCH_MARGIN_DB) {
      this.selectedBeaconId = strongest.id;
      this.candidateBeaconId = null;
      this.candidateCount = 0;
      return { selectedBeaconId: strongest.id, changed: true };
    }

    if (this.candidateBeaconId === strongest.id) {
      this.candidateCount += 1;
    } else {
      this.candidateBeaconId = strongest.id;
      this.candidateCount = 1;
    }

    if (this.candidateCount >= SWITCH_CONSECUTIVE_READINGS) {
      this.selectedBeaconId = strongest.id;
      this.candidateBeaconId = null;
      this.candidateCount = 0;
      return { selectedBeaconId: strongest.id, changed: true };
    }

    return { selectedBeaconId: selected.id, changed: false };
  }
}

export interface LocationUploadDecision {
  selectedChanged: boolean;
  lastUploadSuccessAt: number | null;
  now?: number;
  estimatedCoordinates?: [number, number] | null;
  lastUploadedCoordinates?: [number, number] | null;
  heartbeatMs?: number;
  movementMeters?: number;
  movementMinIntervalMs?: number;
}

export function getLocationUploadReason({
  selectedChanged,
  lastUploadSuccessAt,
  now = Date.now(),
  estimatedCoordinates = null,
  lastUploadedCoordinates = null,
  heartbeatMs = BLE_HEARTBEAT_MS,
  movementMeters = BLE_MOVEMENT_UPLOAD_METERS,
  movementMinIntervalMs = BLE_MOVEMENT_UPLOAD_MIN_INTERVAL_MS,
}: LocationUploadDecision): LocationUploadReason | null {
  if (lastUploadSuccessAt == null) return "first-fix";
  if (selectedChanged) return "selected-change";

  const elapsed = now - lastUploadSuccessAt;
  if (elapsed >= heartbeatMs) return "heartbeat";
  if (
    elapsed >= movementMinIntervalMs &&
    estimatedCoordinates &&
    lastUploadedCoordinates &&
    distanceBetweenCoordinatesMeters(
      lastUploadedCoordinates,
      estimatedCoordinates
    ) >= movementMeters
  ) {
    return "movement";
  }
  return null;
}

export function shouldUploadLocation(
  selectedChanged: boolean,
  lastUploadSuccessAt: number | null,
  now = Date.now(),
  heartbeatMs = BLE_HEARTBEAT_MS
): boolean {
  return Boolean(
    getLocationUploadReason({
      selectedChanged,
      lastUploadSuccessAt,
      now,
      heartbeatMs,
    })
  );
}

export function createLocationFix(
  selectedBeaconId: string,
  observations: BeaconObservation[],
  observedAt = Date.now(),
  uploadReason?: LocationUploadReason
): LocationFix {
  return {
    selectedBeaconId,
    observations: pruneStaleObservations(observations, observedAt),
    observedAt,
    ...(uploadReason ? { uploadReason } : {}),
  };
}

export function latestLocationFix(
  ...fixes: (LocationFix | null | undefined)[]
): LocationFix | null {
  return (
    fixes
      .filter((fix): fix is LocationFix => Boolean(fix))
      .sort((a, b) => b.observedAt - a.observedAt)[0] ?? null
  );
}
