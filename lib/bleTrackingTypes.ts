export const OTAMAPS_SERVICE_UUID = "f47fcfd9-0634-49de-8e99-80d05ae8fcef";
export const BLE_RSSI_THRESHOLD = -80;
export const BLE_BEACON_STALE_MS = 15_000;
export const BLE_HEARTBEAT_MS = 2 * 60 * 1000;
export const BLE_MOVEMENT_UPLOAD_METERS = 8;
export const BLE_MOVEMENT_UPLOAD_MIN_INTERVAL_MS = 30_000;

export type TrackingRuntimeMode =
  | "stopped"
  | "foreground"
  | "android-background"
  | "ios-background";

export type TrackingStatus =
  | "stopped"
  | "starting"
  | "scanning"
  | "blocked"
  | "error";

export type TrackingBlockReason =
  | "consent_required"
  | "permission_denied"
  | "bluetooth_off"
  | "signed_out"
  | "service_error";

export interface StartTrackingResult {
  success: boolean;
  reason?: TrackingBlockReason;
}

export interface BeaconAdvertisement {
  name?: string | null;
  localName?: string | null;
  serviceUUIDs?: string[] | null;
  serviceData?: Record<string, string> | null;
  manufacturerData?: string | null;
  rssi?: number | null;
}

export interface BeaconObservation {
  id: string;
  rssi: number;
  seenAt: number;
}

export interface BeaconCatalogEntry {
  ble_id: string;
  x: number;
  y: number;
  floor: string | null;
  room_id?: string | null;
  room_number?: string | null;
}

export interface ResolvedBeaconObservation extends BeaconObservation {
  coordinates: [number, number];
  floor: string | null;
  distance: number;
}

export type PositionEstimationMethod =
  | "single-beacon"
  | "weighted-centroid";

export interface PositionEstimate {
  anchorBeaconId: string;
  coordinates: [number, number];
  floor: string | null;
  radius: number;
  method: PositionEstimationMethod;
  contributorIds: string[];
}

export type LocationUploadReason =
  | "first-fix"
  | "selected-change"
  | "heartbeat"
  | "movement"
  | "manual"
  | "retry";

export interface LocationFix {
  selectedBeaconId: string;
  observations: BeaconObservation[];
  observedAt: number;
  /** Optional so fixes persisted by older app versions remain readable. */
  uploadReason?: LocationUploadReason;
}

export interface TrackingDiagnostics {
  mode: TrackingRuntimeMode;
  status: TrackingStatus;
  consent: boolean;
  bluetoothState: string;
  permissions: Record<string, string | number | boolean>;
  serviceStartedAt: number | null;
  lastScanAt: number | null;
  lastBeaconId: string | null;
  lastBeaconRssi: number | null;
  selectedBeaconId: string | null;
  estimationMethod: PositionEstimationMethod | null;
  contributingBeaconCount: number;
  lastEstimateAt: number | null;
  lastUploadAttemptAt: number | null;
  lastUploadSuccessAt: number | null;
  lastUploadReason: LocationUploadReason | null;
  pendingUpload: boolean;
  lastError: string | null;
}

export interface BleTrackingSnapshot {
  diagnostics: TrackingDiagnostics;
  beacons: BeaconObservation[];
  currentRoom: string | null;
  coordinates: [number, number] | null;
  floor: number | null;
  radius: number;
  lastUpdated: number;
}

export interface LocationUpdateResult {
  success: boolean;
  currentRoom?: string | null;
  coordinates?: [number, number];
  floor?: string | null;
  radius?: number;
  estimate?: PositionEstimate;
  error?: string;
}
