import { FABLAB_VISIBLE } from "@/constants/features";
import { Redirect, Stack } from "expo-router";

export default function FablabLayout() {
  if (!FABLAB_VISIBLE) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
