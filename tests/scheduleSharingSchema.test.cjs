const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isMissingScheduleSharingSchema,
} = require("../.expo/shared-schedule-test-build/scheduleSharingSchema.js");

test("recognizes missing schedule table and preference column errors", () => {
  assert.equal(isMissingScheduleSharingSchema({ code: "PGRST205" }), true);
  assert.equal(
    isMissingScheduleSharingSchema({
      message: "column user_preferences.schedule_sharing_enabled does not exist",
    }),
    true
  );
});

test("recognizes the legacy consent-purpose constraint", () => {
  assert.equal(
    isMissingScheduleSharingSchema({
      code: "23514",
      message:
        'new row violates check constraint "user_consent_events_purpose_check"',
    }),
    true
  );
});

test("does not swallow unrelated database errors", () => {
  assert.equal(
    isMissingScheduleSharingSchema({ code: "42501", message: "RLS denied" }),
    false
  );
});
