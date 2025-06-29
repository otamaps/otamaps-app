import { Stack } from "expo-router";

export default function WelcomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="(pre)" options={{ headerShown: false }} />
    </Stack>
  );
}
