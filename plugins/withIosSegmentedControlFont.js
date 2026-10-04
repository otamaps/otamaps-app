const { withAppDelegate } = require('@expo/config-plugins');

const MARKER = '// withIosSegmentedControlFont';

const APPEARANCE_SWIFT = `    ${MARKER}
    // SwiftUI's segmented Picker is a UISegmentedControl underneath and
    // ignores font modifiers on its labels; the appearance proxy is the only
    // native way to set them. Lighter than the system's default weights.
    UISegmentedControl.appearance().setTitleTextAttributes(
      [.font: UIFont.systemFont(ofSize: 13, weight: .regular)], for: .normal)
    UISegmentedControl.appearance().setTitleTextAttributes(
      [.font: UIFont.systemFont(ofSize: 13, weight: .medium)], for: .selected)
`;

/**
 * Sets the label font of every native segmented control in the app, at
 * launch, before any is created.
 */
const withIosSegmentedControlFont = (config) => {
  return withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;
    if (appDelegate.language !== 'swift') {
      throw new Error(
        'withIosSegmentedControlFont expects a Swift AppDelegate.swift (found: ' +
          appDelegate.language +
          ')'
      );
    }

    if (!appDelegate.contents.includes(MARKER)) {
      const anchor = '    return super.application(application, didFinishLaunchingWithOptions:';
      if (!appDelegate.contents.includes(anchor)) {
        throw new Error(
          'withIosSegmentedControlFont could not find the didFinishLaunchingWithOptions return in AppDelegate.swift to anchor the insertion.'
        );
      }
      appDelegate.contents = appDelegate.contents.replace(anchor, APPEARANCE_SWIFT + anchor);
    }

    return config;
  });
};

module.exports = withIosSegmentedControlFont;
