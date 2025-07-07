import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const About = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/otamaps-logo.png')}
        style={{ resizeMode: 'contain', width: 200, height: 100 }}
      />

      <Text>Versio 0.0.1</Text>
      <Text>Copyright © 2025 Otamaps</Text>
      <Text>Mahdollistanut</Text>
      <Image
        source={require('@/assets/images/streetsmarts.png')}
        style={{ width: 100, height: 100 }}
        tintColor="gray"
        resizeMode="contain"
      />
    </View>
  )
}

export default About

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
})