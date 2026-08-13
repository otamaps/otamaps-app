import { Linking } from "react-native";

/** Open a user-requested URL without leaking a native rejection globally. */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
