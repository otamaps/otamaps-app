const { withPodfileProperties } = require('@expo/config-plugins');

const MODULAR_GOOGLE_PODS = ['GoogleUtilities', 'RecaptchaInterop'];

/**
 * GoogleSignIn pulls in the Swift AppCheckCore pod. When CocoaPods links it as
 * a static library, its Objective-C dependencies need module maps so Swift can
 * import them. Expo autolinking reads apple.extraPods from
 * Podfile.properties.json and supports per-pod modular headers.
 */
const withIosGoogleModularHeaders = (config) =>
  withPodfileProperties(config, (config) => {
    const existingValue = config.modResults['apple.extraPods'];
    const extraPods = existingValue ? JSON.parse(existingValue) : [];

    for (const name of MODULAR_GOOGLE_PODS) {
      const existingPod = extraPods.find((pod) => pod.name === name);
      if (existingPod) {
        existingPod.modular_headers = true;
      } else {
        extraPods.push({ name, modular_headers: true });
      }
    }

    config.modResults['apple.extraPods'] = JSON.stringify(extraPods);
    return config;
  });

module.exports = withIosGoogleModularHeaders;
