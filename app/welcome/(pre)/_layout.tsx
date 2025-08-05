import { Stack } from 'expo-router';

export default function WelcomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="login" 
        options={{ 
          headerShown: false,
          presentation: 'card',
          gestureEnabled: false 
        }} 
      />
    </Stack>
  );
}
