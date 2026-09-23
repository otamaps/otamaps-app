import { Stack } from "expo-router";

/**
 * The tab holds its own stack so its screen can carry the platform
 * navigation bar — a tab is a screen of the root stack, and options set from
 * inside one would otherwise configure the whole tab container. Mirrors
 * `(tabs)/fablab`.
 */
export default function MeLayout() {
  return <Stack />;
}
