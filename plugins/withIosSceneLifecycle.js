const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const MARKER = '// withIosSceneLifecycle';

// The iOS 27 SDK asserts at launch (`UIApplication` "no scene lifecycle
// adoption") unless the app is scene-based. Expo ships the scene delegate
// (`ExpoAppSceneDelegate`) in SDK 57 but only SDK 58's template uses it, so
// this applies the same change to the SDK 57 template.

const SCENE_DELEGATE_SWIFT = `
${MARKER}
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

// The window is now created, and React Native started, by the scene delegate.
const WINDOW_AND_START_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n\n?/;

const SCENE_REPLACEMENT = `    // The window is created and React Native is started by \`SceneDelegate\` under the
    // scene-based life cycle (required by the iOS 27 SDK).
`;

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;
    if (appDelegate.language !== 'swift') {
      throw new Error(
        'withIosSceneLifecycle expects a Swift AppDelegate.swift (found: ' + appDelegate.language + ')'
      );
    }

    let contents = appDelegate.contents;
    if (contents.includes(MARKER)) return config;

    const classDecl = 'class AppDelegate: ExpoAppDelegate {';
    if (!contents.includes(classDecl)) {
      throw new Error(
        'withIosSceneLifecycle could not find "' + classDecl + '" in AppDelegate.swift. ' +
          'If the template already adopts scenes, remove this plugin.'
      );
    }
    contents = contents.replace(classDecl, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');

    if (!WINDOW_AND_START_BLOCK.test(contents)) {
      throw new Error(
        'withIosSceneLifecycle could not find the window/startReactNative block in AppDelegate.swift to remove.'
      );
    }
    contents = contents.replace(WINDOW_AND_START_BLOCK, SCENE_REPLACEMENT);

    appDelegate.contents = contents.trimEnd() + '\n' + SCENE_DELEGATE_SWIFT;
    return config;
  });

const withSceneInfoPlist = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });

const withIosSceneLifecycle = (config) => withSceneInfoPlist(withSceneAppDelegate(config));

module.exports = withIosSceneLifecycle;
