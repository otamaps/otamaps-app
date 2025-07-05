import React from 'react';
import { Image, Text, View } from 'react-native';

const About = () => {
  return (
    <View>
      <Image
        source={require('@/assets/images/otamaps-logo.png')}
        style={{ resizeMode: 'contain', width: 200, height: 200 }}
      />

      <Text>Version 1.0.0</Text>
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