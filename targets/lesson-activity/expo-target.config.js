/** @type {import('@bacons/apple-targets/app.config').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LessonActivity",
  // The Live Activity only ever renders data the app hands it, so it needs no
  // capabilities of its own — no App Group, no network.
  entitlements: {},
  deploymentTarget: "16.4",
});
