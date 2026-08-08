import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appConfig = JSON.parse(readFileSync(join(root, "app.json"), "utf8"));
const easConfig = JSON.parse(readFileSync(join(root, "eas.json"), "utf8"));
const pluginSource = readFileSync(
  join(root, "plugins/withNotifeeAndroid.js"),
  "utf8"
);

test("iOS enables only the Core Bluetooth central background role", () => {
  const blePlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "react-native-ble-plx"
  );
  assert.deepEqual(blePlugin[1].modes, ["central"]);
});

test("Android declares a persistent connected-device foreground service", () => {
  assert.match(pluginSource, /foregroundServiceType'\] = 'connectedDevice'/);
  assert.match(pluginSource, /stopWithTask'\] = 'false'/);
  assert.match(pluginSource, /FOREGROUND_SERVICE_CONNECTED_DEVICE/);
  assert.match(pluginSource, /ACCESS_BACKGROUND_LOCATION/);
  assert.match(pluginSource, /android:maxSdkVersion': '30'/);
});

test("all EAS build profiles use the canonical Supabase project", () => {
  for (const profileName of ["development", "preview", "production"]) {
    assert.equal(
      easConfig.build[profileName].env.EXPO_PUBLIC_SUPABASE_URL,
      "https://db.otamaps.fi"
    );
    assert.match(
      easConfig.build[profileName].env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      /^sb_publishable_/
    );
    assert.equal(
      easConfig.build[profileName].env.EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED,
      "true"
    );
  }
});
