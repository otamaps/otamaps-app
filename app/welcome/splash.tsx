import { Stack } from 'expo-router';
import React from 'react';
import { Dimensions, Image, StatusBar, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content"/>
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/otamaps-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>mahdollistanut</Text>
        <Image
          source={require('@/assets/images/streetsmarts.png')}
          style={{ width: 100, height: 100 }}
          tintColor="gray"
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    width: "100%",
    justifyContent: 'center',
  },
  logo: {
    width: "35%",
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    zIndex: 20,
    alignItems: 'center',
    
  },
  footerText: {
    fontSize: 12,
    color: 'gray',
  },
});
