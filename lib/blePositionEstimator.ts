import {
  BeaconCatalogEntry,
  BeaconObservation,
  PositionEstimate,
  ResolvedBeaconObservation,
} from "./bleTrackingTypes";

const MEASURED_POWER_DBM = -59;
const PATH_LOSS_EXPONENT = 2.5;
const MAX_CONTRIBUTING_BEACONS = 4;
const MIN_WEIGHT_DISTANCE_METERS = 1;
const MAX_WEIGHT_DISTANCE_METERS = 10;
const EARTH_RADIUS_METERS = 6_371_000;

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeFloor(floor: string | null | undefined): string | null {
  if (floor == null) return null;
  const normalized = String(floor).trim();
  return normalized.length > 0 ? normalized : null;
}

export function calculateDistanceFromRSSI(rssi: number): number {
  if (!Number.isFinite(rssi) || rssi === 0) return 50;
  return Math.pow(
    10,
    (MEASURED_POWER_DBM - rssi) / (10 * PATH_LOSS_EXPONENT)
  );
}

export function resolveBeaconObservations(
  observations: BeaconObservation[],
  catalog: ReadonlyMap<string, BeaconCatalogEntry>
): ResolvedBeaconObservation[] {
  const resolved: ResolvedBeaconObservation[] = [];
  for (const observation of observations) {
    const beacon = catalog.get(observation.id);
    if (
      !beacon ||
      !isFiniteCoordinate(beacon.x) ||
      !isFiniteCoordinate(beacon.y) ||
      !Number.isFinite(observation.rssi)
    ) {
      continue;
    }
    resolved.push({
      ...observation,
      coordinates: [beacon.x, beacon.y],
      floor: normalizeFloor(beacon.floor),
      distance: calculateDistanceFromRSSI(observation.rssi),
    });
  }
  return resolved;
}

function calculateLocationRadius(
  contributors: ResolvedBeaconObservation[]
): number {
  if (contributors.length === 0) return 50;
  const nearestDistance = Math.min(
    ...contributors.map((beacon) => beacon.distance)
  );
  return Math.max(
    5,
    nearestDistance + (contributors.length > 1 ? 5 : 15)
  );
}

function ensureAnchorIncluded(
  strongest: ResolvedBeaconObservation[],
  anchor: ResolvedBeaconObservation
): ResolvedBeaconObservation[] {
  if (strongest.some((beacon) => beacon.id === anchor.id)) return strongest;
  return [...strongest.slice(0, MAX_CONTRIBUTING_BEACONS - 1), anchor].sort(
    (a, b) => b.rssi - a.rssi
  );
}

export function estimatePosition(
  selectedBeaconId: string,
  observations: BeaconObservation[],
  catalog: ReadonlyMap<string, BeaconCatalogEntry>
): PositionEstimate | null {
  const resolved = resolveBeaconObservations(observations, catalog);
  const anchor = resolved.find((beacon) => beacon.id === selectedBeaconId);
  if (!anchor) return null;

  const singleBeaconEstimate = (): PositionEstimate => ({
    anchorBeaconId: anchor.id,
    coordinates: anchor.coordinates,
    floor: anchor.floor,
    radius: calculateLocationRadius([anchor]),
    method: "single-beacon",
    contributorIds: [anchor.id],
  });

  // Without an authoritative anchor floor, blending could pull a position
  // through a ceiling. Fall back to the anchor coordinate instead.
  if (anchor.floor == null) return singleBeaconEstimate();

  const strongestOnFloor = resolved
    .filter((beacon) => beacon.floor === anchor.floor)
    .sort((a, b) => b.rssi - a.rssi)
    .slice(0, MAX_CONTRIBUTING_BEACONS);
  const contributors = ensureAnchorIncluded(strongestOnFloor, anchor);
  if (contributors.length < 2) return singleBeaconEstimate();

  let longitudeTotal = 0;
  let latitudeTotal = 0;
  let weightTotal = 0;
  for (const beacon of contributors) {
    const distance = Math.max(
      MIN_WEIGHT_DISTANCE_METERS,
      Math.min(MAX_WEIGHT_DISTANCE_METERS, beacon.distance)
    );
    const weight = 1 / distance;
    longitudeTotal += beacon.coordinates[0] * weight;
    latitudeTotal += beacon.coordinates[1] * weight;
    weightTotal += weight;
  }

  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    return singleBeaconEstimate();
  }

  return {
    anchorBeaconId: anchor.id,
    coordinates: [longitudeTotal / weightTotal, latitudeTotal / weightTotal],
    floor: anchor.floor,
    radius: calculateLocationRadius(contributors),
    method: "weighted-centroid",
    contributorIds: contributors.map((beacon) => beacon.id),
  };
}

export function distanceBetweenCoordinatesMeters(
  from: [number, number],
  to: [number, number]
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const fromLatitude = toRadians(from[1]);
  const toLatitude = toRadians(to[1]);
  const latitudeDelta = toLatitude - fromLatitude;
  const longitudeDelta = toRadians(to[0] - from[0]);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}
