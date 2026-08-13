const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFetchTimeoutError,
  isFetchCancellation,
  isTransientNetworkError,
} = require("../.expo/network-test-build/networkErrors.js");

test("recognizes the Expo SDK 57 native cancellation message", () => {
  assert.equal(
    isFetchCancellation(
      new Error("fetch failed: Fetch request has been canceled")
    ),
    true
  );
});

test("recognizes standard and nested abort errors", () => {
  const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
  assert.equal(isFetchCancellation(abortError), true);
  assert.equal(
    isFetchCancellation(new Error("fetch failed", { cause: abortError })),
    true
  );
});

test("uses the request signal as authoritative cancellation state", () => {
  assert.equal(
    isFetchCancellation(new Error("native request failed"), { aborted: true }),
    true
  );
});

test("does not suppress ordinary network errors", () => {
  assert.equal(isFetchCancellation(new TypeError("Network request failed")), false);
});

test("creates a stable, actionable timeout error", () => {
  const cause = new Error("fetch failed: Fetch request has been canceled");
  const error = createFetchTimeoutError("Request timed out", cause);
  assert.equal(error.name, "FetchTimeoutError");
  assert.equal(error.code, "ETIMEDOUT");
  assert.equal(error.message, "Request timed out");
  assert.equal(error.cause, cause);
});

test("recognizes temporary connectivity and backend-capacity failures", () => {
  assert.equal(isTransientNetworkError(new TypeError("Network request failed")), true);
  assert.equal(
    isTransientNetworkError(new Error("PGRST003: Timed out acquiring connection from connection pool")),
    true
  );
  assert.equal(isTransientNetworkError({ code: "57014", message: "statement timeout" }), true);
  assert.equal(isTransientNetworkError(new Error("error code: 504")), true);
});

test("does not classify authentication or validation failures as network failures", () => {
  assert.equal(isTransientNetworkError(new Error("Invalid login credentials")), false);
  assert.equal(isTransientNetworkError({ code: "PGRST116", message: "No rows" }), false);
});
