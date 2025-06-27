import { Tabs } from 'expo-router';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalProvider } from '@gorhom/portal';
import React from 'react';
import { Platform, View } from 'react-native';

export default function TabLayout() {
  return (
    <BottomSheetModalProvider>
      <PortalProvider>
        <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
        }}
        />
      </Tabs>
      </PortalProvider>
    </BottomSheetModalProvider>
  );
}
