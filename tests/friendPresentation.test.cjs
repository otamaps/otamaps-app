const assert = require("node:assert/strict");
const test = require("node:test");
const {
  friendLocationListLabel,
  friendLocationSentence,
} = require("../.expo/shared-schedule-test-build/friendPresentation.js");

test("missing and legacy unknown locations use a Finnish empty state", () => {
  for (const value of [undefined, "", "Unknown location", "ei sijaintia"]) {
    assert.equal(friendLocationSentence(value), "Ei sijaintia vielä");
    assert.equal(friendLocationListLabel(value), "Ei sijaintia vielä");
  }
});

test("known rooms are presented without an unknown-location suffix", () => {
  assert.equal(friendLocationSentence("U261"), "Luokassa U261");
  assert.equal(friendLocationListLabel("U261"), "U261");
});
