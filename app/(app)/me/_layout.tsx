import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <Stack>
      <StatusBar style="dark" />
      <Stack.Screen name="about" options={{ title: 'Tietoja' }} />
      <Stack.Screen name="settings" options={{ title: 'Asetukset' }} />
      <Stack.Screen name="wilma/index" options={{ title: 'Yhdistetään Wilma-tili' }} />
    </Stack>
  );
}
