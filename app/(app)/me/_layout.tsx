import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="about" options={{ title: 'Tietoja' }} />
      <Stack.Screen name="settings" options={{ title: 'Asetukset' }} />
    </Stack>
  );
}
