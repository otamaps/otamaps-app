import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Dimensions, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const permissions = [
  {
    id: 'notifications',
    title: 'Enable Notifications',
    description: 'Get important updates and alerts about your friends and events.',
    icon: 'notifications',
    color: '#4CAF50',
    request: async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    }
  },
  {
    id: 'location',
    title: 'Location Access',
    description: 'Allow access to your location to see nearby friends and places.',
    icon: 'location-on',
    color: '#2196F3',
    request: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    }
  },
  {
    id: 'background-location',
    title: 'Background Location',
    description: 'Allow location access in the background to update your position when the app is not in use.',
    icon: 'location-searching',
    color: '#673AB7',
    request: async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    }
  },
  {
    id: 'bluetooth',
    title: 'Bluetooth',
    description: 'Allow Bluetooth to connect with nearby devices and enhance your experience.',
    icon: 'bluetooth',
    color: '#3F51B5',
    request: async () => {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
      }
      return true; // iOS handles BLE permissions differently
    }
  }
];

export default function PermissionsScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grantedPermissions, setGrantedPermissions] = useState<Record<string, boolean>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();

  const handlePermissionRequest = async (permission: typeof permissions[0]) => {
    try {
      const granted = await permission.request();
      setGrantedPermissions(prev => ({
        ...prev,
        [permission.id]: granted
      }));
      return granted;
    } catch (error) {
      console.error(`Error requesting ${permission.id} permission:`, error);
      return false;
    }
  };

  const handleNext = async () => {
    const currentPermission = permissions[currentIndex];
    const granted = await handlePermissionRequest(currentPermission);
    
    if (currentIndex < permissions.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex + 1),
        animated: true
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      // All permissions handled, navigate away
      router.replace('/(app)');
    }
  };

  const handleSkip = () => {
    if (currentIndex < permissions.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex + 1),
        animated: true
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(app)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        {permissions.map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.progressDot, 
              index === currentIndex && styles.activeDot,
              index < currentIndex && styles.completedDot
            ]} 
          />
        ))}
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
      >
        {permissions.map((permission) => (
          <View key={permission.id} style={styles.slide}>
            <View style={[styles.iconContainer, { backgroundColor: `${permission.color}20` }]}>
              <MaterialIcons name={permission.icon as any} size={80} color={permission.color} />
            </View>
            <Text style={styles.title}>{permission.title}</Text>
            <Text style={styles.description}>{permission.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.skipButton]}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>
            {currentIndex === permissions.length - 1 ? 'Finish' : 'Skip'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.nextButton, { backgroundColor: permissions[currentIndex].color }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === permissions.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#2196F3',
    width: 24,
  },
  completedDot: {
    backgroundColor: '#4CAF50',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: width - 40,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  skipButton: {
    marginRight: 10,
    backgroundColor: '#F5F5F5',
  },
  nextButton: {
    marginLeft: 10,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
