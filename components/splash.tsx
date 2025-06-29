import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export const SplashScreenController = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A89EE" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
