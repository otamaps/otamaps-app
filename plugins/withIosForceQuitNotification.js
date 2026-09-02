const { withAppDelegate } = require('@expo/config-plugins');

// Keep this key in sync with the one used by lib/bleTrackingRuntime.ts
// (written via react-native's `Settings` API, which wraps NSUserDefaults).
const TRACKING_ACTIVE_DEFAULTS_KEY = 'otamaps_background_tracking_active';

const NOTIFICATION_TITLE = 'Keep OtaMaps running in the background';
const NOTIFICATION_BODY =
  "Force quitting doesn't save battery or speed up your phone — it just stops beacon tracking and location features until you reopen the app.";

const APPLICATION_WILL_TERMINATE_SWIFT = `
  public override func applicationWillTerminate(_ application: UIApplication) {
    if UserDefaults.standard.bool(forKey: "${TRACKING_ACTIVE_DEFAULTS_KEY}") {
      let content = UNMutableNotificationContent()
      content.title = "${NOTIFICATION_TITLE}"
      content.body = "${NOTIFICATION_BODY}"
      content.sound = .default
      let request = UNNotificationRequest(
        identifier: "otamaps.force_quit_warning",
        content: content,
        trigger: nil
      )
      UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
    super.applicationWillTerminate(application)
  }
`;

/**
 * iOS force-quits Core Bluetooth scanning and opts the app out of background
 * relaunch for beacon events. Warn the user with a local notification when
 * they force-quit while background BLE tracking is active, since this
 * silently breaks location features until they reopen the app.
 */
const withIosForceQuitNotification = (config) => {
  return withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;
    if (appDelegate.language !== 'swift') {
      throw new Error(
        'withIosForceQuitNotification expects a Swift AppDelegate.swift (found: ' +
          appDelegate.language +
          ')'
      );
    }

    let contents = appDelegate.contents;

    if (!contents.includes('import UserNotifications')) {
      contents = contents.replace(
        'import React\n',
        'import React\nimport UserNotifications\n'
      );
    }

    if (!contents.includes('applicationWillTerminate')) {
      const classEndMarker = '\nclass ReactNativeDelegate';
      const markerIndex = contents.indexOf(classEndMarker);
      if (markerIndex === -1) {
        throw new Error(
          'withIosForceQuitNotification could not find "class ReactNativeDelegate" in AppDelegate.swift to anchor the insertion.'
        );
      }
      const beforeMarker = contents.slice(0, markerIndex);
      const lastBraceIndex = beforeMarker.lastIndexOf('}');
      if (lastBraceIndex === -1) {
        throw new Error(
          'withIosForceQuitNotification could not find the closing brace of the AppDelegate class.'
        );
      }
      contents =
        beforeMarker.slice(0, lastBraceIndex) +
        APPLICATION_WILL_TERMINATE_SWIFT +
        '}' +
        contents.slice(markerIndex);
    }

    appDelegate.contents = contents;
    return config;
  });
};

module.exports = withIosForceQuitNotification;
