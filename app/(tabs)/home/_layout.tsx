import { Stack } from "expo-router";

/**
 * The tab holds its own stack so the dashboard can carry a navigation bar —
 * a tab is a screen of the root stack, and options set from inside one would
 * otherwise configure the whole tab container. Mirrors `(tabs)/fablab`.
 *
 * Hidden by default: the session check and the login form want no bar. The
 * dashboard turns it on itself, with the greeting as its large title.
 */
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
