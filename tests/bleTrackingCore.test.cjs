const assert = require("node:assert/strict");
const test = require("node:test");
const { Buffer } = require("buffer");
const {
  BeaconSelectionEngine,
  getLocationUploadReason,
  latestLocationFix,
  parseBeaconAdvertisement,
  pruneStaleObservations,
  shouldUploadLocation,
  smoothBeaconObservation,
} = require("../.expo/ble-test-build/bleTrackingCore.js");
const {
  distanceBetweenCoordinatesMeters,
  estimatePosition,
} = require("../.expo/ble-test-build/blePositionEstimator.js");
const {
  BeaconCatalogCache,
} = require("../.expo/ble-test-build/bleBeaconCatalog.js");
const {
  OTAMAPS_SERVICE_UUID,
} = require("../.expo/ble-test-build/bleTrackingTypes.js");

const encoded = (value) => Buffer.from(value).toString("base64");

test("accepts a valid OtaMaps advertisement without a device name", () => {
  const observation = parseBeaconAdvertisement(
    {
      name: null,
      localName: null,
      serviceUUIDs: [OTAMAPS_SERVICE_UUID.toUpperCase()],
      serviceData: { [OTAMAPS_SERVICE_UUID.toUpperCase()]: encoded("A123") },
      rssi: -60,
    },
    1234
  );
  assert.deepEqual(observation, { id: "A123", rssi: -60, seenAt: 1234 });
});

test("uses manufacturer data only when the OtaMaps service is advertised", () => {
  const valid = parseBeaconAdvertisement({
    serviceUUIDs: [OTAMAPS_SERVICE_UUID],
    manufacturerData: encoded("002"),
    rssi: -55,
  });
  const unrelated = parseBeaconAdvertisement({
    serviceUUIDs: ["11111111-1111-1111-1111-111111111111"],
    manufacturerData: encoded("002"),
    rssi: -55,
  });
  assert.equal(valid?.id, "002");
  assert.equal(unrelated, null);
});

test("rejects weak, empty, unconfigured, and control-character payloads", () => {
  const base = { serviceUUIDs: [OTAMAPS_SERVICE_UUID], rssi: -50 };
  assert.equal(
    parseBeaconAdvertisement({ ...base, rssi: -81, manufacturerData: encoded("1") }),
    null
  );
  assert.equal(
    parseBeaconAdvertisement({ ...base, manufacturerData: encoded("none") }),
    null
  );
  assert.equal(
    parseBeaconAdvertisement({ ...base, manufacturerData: encoded("") }),
    null
  );
  assert.equal(
    parseBeaconAdvertisement({ ...base, manufacturerData: encoded("bad\nvalue") }),
    null
  );
});

test("prunes stale observations", () => {
  const observations = [
    { id: "old", rssi: -40, seenAt: 1_000 },
    { id: "fresh", rssi: -50, seenAt: 19_000 },
  ];
  assert.deepEqual(pruneStaleObservations(observations, 20_000), [
    observations[1],
  ]);
});

test("smooths repeated beacon RSSI with a 0.25 exponential average", () => {
  const previous = { id: "A", rssi: -60, seenAt: 1_000 };
  const next = { id: "A", rssi: -70, seenAt: 2_000 };
  assert.deepEqual(smoothBeaconObservation(previous, next), {
    id: "A",
    rssi: -62.5,
    seenAt: 2_000,
  });
  assert.equal(
    smoothBeaconObservation(previous, { ...next, seenAt: 20_000 }).rssi,
    -70
  );
});

test("switches immediately for a 6 dB advantage", () => {
  const engine = new BeaconSelectionEngine();
  engine.select([{ id: "A", rssi: -65, seenAt: 1_000 }], 1_000);
  assert.deepEqual(
    engine.select(
      [
        { id: "A", rssi: -65, seenAt: 2_000 },
        { id: "B", rssi: -59, seenAt: 2_000 },
      ],
      2_000
    ),
    { selectedBeaconId: "B", changed: true }
  );
});

test("requires three consistent readings for a smaller RSSI advantage", () => {
  const engine = new BeaconSelectionEngine();
  engine.select([{ id: "A", rssi: -60, seenAt: 1_000 }], 1_000);
  const observations = (seenAt) => [
    { id: "A", rssi: -60, seenAt },
    { id: "B", rssi: -58, seenAt },
  ];
  assert.equal(engine.select(observations(2_000), 2_000).selectedBeaconId, "A");
  assert.equal(engine.select(observations(3_000), 3_000).selectedBeaconId, "A");
  assert.deepEqual(engine.select(observations(4_000), 4_000), {
    selectedBeaconId: "B",
    changed: true,
  });
});

test("switches when the previously selected beacon is stale", () => {
  const engine = new BeaconSelectionEngine();
  engine.select([{ id: "A", rssi: -50, seenAt: 1_000 }], 1_000);
  assert.deepEqual(
    engine.select([{ id: "B", rssi: -70, seenAt: 20_000 }], 20_000),
    { selectedBeaconId: "B", changed: true }
  );
});

test("uploads on change or heartbeat, but not between heartbeats", () => {
  assert.equal(shouldUploadLocation(true, 10_000, 20_000), true);
  assert.equal(shouldUploadLocation(false, null, 20_000), true);
  assert.equal(shouldUploadLocation(false, 10_000, 20_000), false);
  assert.equal(shouldUploadLocation(false, 10_000, 130_000), true);
});

test("movement uploads require eight metres and a 30 second interval", () => {
  const from = [24.8185, 60.1839];
  const underEightMeters = [24.8185, 60.18396];
  const overEightMeters = [24.8185, 60.184];
  assert.ok(distanceBetweenCoordinatesMeters(from, underEightMeters) < 8);
  assert.ok(distanceBetweenCoordinatesMeters(from, overEightMeters) > 8);
  assert.equal(
    getLocationUploadReason({
      selectedChanged: false,
      lastUploadSuccessAt: 10_000,
      now: 39_999,
      estimatedCoordinates: overEightMeters,
      lastUploadedCoordinates: from,
    }),
    null
  );
  assert.equal(
    getLocationUploadReason({
      selectedChanged: false,
      lastUploadSuccessAt: 10_000,
      now: 40_000,
      estimatedCoordinates: underEightMeters,
      lastUploadedCoordinates: from,
    }),
    null
  );
  assert.equal(
    getLocationUploadReason({
      selectedChanged: false,
      lastUploadSuccessAt: 10_000,
      now: 40_000,
      estimatedCoordinates: overEightMeters,
      lastUploadedCoordinates: from,
    }),
    "movement"
  );
  assert.equal(
    getLocationUploadReason({
      selectedChanged: true,
      lastUploadSuccessAt: 39_000,
      now: 40_000,
    }),
    "selected-change"
  );
  assert.equal(
    getLocationUploadReason({
      selectedChanged: false,
      lastUploadSuccessAt: null,
      now: 40_000,
    }),
    "first-fix"
  );
});

const observation = (id, rssi, seenAt = 1_000) => ({ id, rssi, seenAt });
const beacon = (id, x, y, floor = "1") => ({
  ble_id: id,
  x,
  y,
  floor,
});
const catalog = (...beacons) =>
  new Map(beacons.map((entry) => [entry.ble_id, entry]));

test("a single beacon estimate retains exact anchor coordinates", () => {
  const estimate = estimatePosition(
    "A",
    [observation("A", -59)],
    catalog(beacon("A", 24.8, 60.1))
  );
  assert.deepEqual(estimate?.coordinates, [24.8, 60.1]);
  assert.equal(estimate?.method, "single-beacon");
  assert.deepEqual(estimate?.contributorIds, ["A"]);
});

test("equal two-beacon signals produce their midpoint", () => {
  const estimate = estimatePosition(
    "A",
    [observation("A", -59), observation("B", -59)],
    catalog(beacon("A", 0, 0), beacon("B", 2, 2))
  );
  assert.deepEqual(estimate?.coordinates, [1, 1]);
  assert.equal(estimate?.method, "weighted-centroid");
});

test("unequal signals pull the estimate toward the stronger beacon", () => {
  const estimate = estimatePosition(
    "A",
    [observation("A", -59), observation("B", -74)],
    catalog(beacon("A", 0, 0), beacon("B", 2, 0))
  );
  assert.ok(estimate);
  assert.ok(estimate.coordinates[0] > 0);
  assert.ok(estimate.coordinates[0] < 1);
});

test("the centroid uses at most four same-floor beacons and stays bounded", () => {
  const observations = [
    observation("A", -59),
    observation("B", -60),
    observation("C", -61),
    observation("D", -62),
    observation("E", -63),
    observation("UP", -40),
  ];
  const estimate = estimatePosition(
    "A",
    observations,
    catalog(
      beacon("A", 0, 0),
      beacon("B", 2, 0),
      beacon("C", 0, 2),
      beacon("D", 2, 2),
      beacon("E", 100, 100),
      beacon("UP", 200, 200, "2")
    )
  );
  assert.ok(estimate);
  assert.equal(estimate.contributorIds.length, 4);
  assert.ok(!estimate.contributorIds.includes("UP"));
  assert.ok(estimate.coordinates[0] >= 0 && estimate.coordinates[0] <= 2);
  assert.ok(estimate.coordinates[1] >= 0 && estimate.coordinates[1] <= 2);
});

test("floorless, unknown, and invalid anchors safely fall back or fail", () => {
  const floorless = estimatePosition(
    "A",
    [observation("A", -59), observation("B", -59)],
    catalog(beacon("A", 1, 2, null), beacon("B", 3, 4, null))
  );
  assert.equal(floorless?.method, "single-beacon");
  assert.deepEqual(floorless?.coordinates, [1, 2]);
  assert.equal(
    estimatePosition(
      "missing",
      [observation("missing", -59)],
      catalog(beacon("A", 1, 2))
    ),
    null
  );
  assert.equal(
    estimatePosition(
      "bad",
      [observation("bad", -59)],
      catalog(beacon("bad", Number.NaN, 2))
    ),
    null
  );
});

test("catalog refresh is single-flight and missing ids are fetched in one batch", async () => {
  let now = 1_000_000;
  let fullFetches = 0;
  const missingBatches = [];
  let stored = null;
  const cache = new BeaconCatalogCache(
    {
      async read() {
        return stored;
      },
      async write(snapshot) {
        stored = snapshot;
      },
      async clear() {
        stored = null;
      },
    },
    {
      async fetchAll() {
        fullFetches += 1;
        await Promise.resolve();
        return [beacon("A", 0, 0)];
      },
      async fetchByIds(ids) {
        missingBatches.push([...ids]);
        return ids.map((id, index) => beacon(id, index + 1, 0));
      },
    },
    { ttlMs: 100, cacheMissRefreshMs: 300, now: () => now }
  );

  await Promise.all([cache.resolve(["A"]), cache.resolve(["A"])]);
  assert.equal(fullFetches, 1);
  now += 1;
  const resolved = await cache.resolve(["B", "C"]);
  assert.deepEqual(missingBatches, [["B", "C"]]);
  assert.ok(resolved.has("B"));
  assert.ok(resolved.has("C"));
});

test("offline/coalesced retry keeps only the newest location fix", () => {
  const older = { selectedBeaconId: "A", observations: [], observedAt: 10 };
  const newer = { selectedBeaconId: "B", observations: [], observedAt: 20 };
  assert.equal(latestLocationFix(older, newer), newer);
  assert.equal(latestLocationFix(null, older), older);
});
