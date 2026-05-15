const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds the Notifee ForegroundService declaration and required permissions to AndroidManifest.xml.
 * Notifee v9 does not ship an Expo config plugin, so we handle it here.
 *
 * Required for:
 * - Android 14+ foreground service type enforcement (connectedDevice for BLE)
 * - FOREGROUND_SERVICE_CONNECTED_DEVICE permission (Android 14+)
 * - BLUETOOTH_SCAN permission (Android 12+)
 * - ACCESS_BACKGROUND_LOCATION for background BLE scanning
 */
const withNotifeeAndroid = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApp = manifest.manifest.application[0];

    // Declare Notifee ForegroundService with the connectedDevice type (required on Android 14+)
    if (!mainApp.service) mainApp.service = [];
    const existing = mainApp.service.find(
      (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
    );
    if (existing) {
      existing.$['android:foregroundServiceType'] = 'connectedDevice';
      existing.$['android:exported'] = 'false';
    } else {
      mainApp.service.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'connectedDevice',
          'android:exported': 'false',
        },
      });
    }

    // Add required permissions that can't easily go through app.json's permissions array
    const perms = manifest.manifest['uses-permission'] || [];
    const needed = [
      { 'android:name': 'android.permission.FOREGROUND_SERVICE' },
      { 'android:name': 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE' },
      { 'android:name': 'android.permission.BLUETOOTH_SCAN' },
      { 'android:name': 'android.permission.ACCESS_BACKGROUND_LOCATION' },
    ];
    for (const attr of needed) {
      if (!perms.some((p) => p.$?.['android:name'] === attr['android:name'])) {
        perms.push({ $: attr });
      }
    }
    manifest.manifest['uses-permission'] = perms;

    return config;
  });
};

module.exports = withNotifeeAndroid;
