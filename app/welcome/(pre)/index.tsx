import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <ImageBackground
          source={require('@/assets/images/login-bg.png')}
          style={styles.backgroundImage}
        >
          {/* Top white gradient */}
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0)']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          
          {/* Bottom white gradient */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.98)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
        </ImageBackground>
      </View>
      <View style={styles.overlay}>
        <View style={styles.topContainer}>
          <Text style={styles.tervetuloa}>Tervetuloa!</Text>
          <Image
            source={require('@/assets/images/otamaps-logo.png')}
            style={styles.omLogo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.logoContainer}>
          <Text style={styles.mahdollistanut}>Mahdollistanut</Text>
          <Image
            source={require('@/assets/images/streetsmarts.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/welcome/login')}
          >
            <Text style={styles.buttonText}>Aloitetaan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    paddingVertical: 50,
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 2,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  topContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: height * 0.05,
    width: '100%',
    flex: 1,
  },
  tervetuloa: {
    fontSize: 28,
    fontFamily: 'Figtree-SemiBold',
    textAlign: 'center',
    color: '#555',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.2,
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  omLogo: {
    width: 250,
    height: 100,
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  mahdollistanut: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    textAlign: 'center',
    color: '#cbb57f',
  },
  button: {
    backgroundColor: '#007AFF', 
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 50,
    width: '90%',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Figtree-SemiBold',
  },
});