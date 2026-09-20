// Variant config — EXPERIMENTAL REDESIGN BRANCH ONLY. Do not merge to main.
//
// Reads the committed app.json as the base and, when OTAMAPS_VARIANT=liquid,
// rewrites identity so the redesign installs alongside prod on the same device.
// Everything else (plugins, permissions, targets) is inherited untouched, so
// app.json stays the single source of truth and merges cleanly.
const base = require("./app.json").expo;

module.exports = () => {
  // Read at call time, not module load, so the env var is always observed.
  if (process.env.OTAMAPS_VARIANT !== "liquid") return { expo: base };

  return {
    expo: {
      ...base,
      name: "OtaMaps Liquid",
      slug: base.slug,
      scheme: "otamapsliquid",
      // The redesign must never pull prod's OTA bundle.
      updates: { enabled: false },
      ios: {
        ...base.ios,
        bundleIdentifier: `${base.ios.bundleIdentifier}.liquid`,
        buildNumber: "1",
      },
      android: {
        ...base.android,
        package: `${base.android.package}.liquid`,
        versionCode: 1,
      },
    },
  };
};
