// Variant config — EXPERIMENTAL REDESIGN BRANCH ONLY. Do not merge to main.
//
// Reads the committed app.json as the base and, when OTAMAPS_VARIANT is set,
// rewrites identity so that build installs alongside prod on the same device.
// Everything else (plugins, permissions, targets) is inherited untouched, so
// app.json stays the single source of truth and merges cleanly.
//
// Variants:
//   liquid — the redesign; never pulls prod's OTA bundle.
//   dev    — development builds; Google sign-in is not set up for its bundle ID.
const base = require("./app.json").expo;

const VARIANTS = {
  liquid: {
    name: "OtaMaps Liquid",
    suffix: "liquid",
    scheme: "otamapsliquid",
    updates: { enabled: false },
  },
  dev: {
    name: "OtaMaps Dev",
    suffix: "dev",
    scheme: "otamapsdev",
  },
};

module.exports = () => {
  // Read at call time, not module load, so the env var is always observed.
  const variant = VARIANTS[process.env.OTAMAPS_VARIANT ?? ""];
  if (!variant) return { expo: base };

  return {
    expo: {
      ...base,
      name: variant.name,
      slug: base.slug,
      scheme: variant.scheme,
      ...(variant.updates && { updates: variant.updates }),
      ios: {
        ...base.ios,
        bundleIdentifier: `${base.ios.bundleIdentifier}.${variant.suffix}`,
        buildNumber: "1",
      },
      android: {
        ...base.android,
        package: `${base.android.package}.${variant.suffix}`,
        versionCode: 1,
      },
    },
  };
};
