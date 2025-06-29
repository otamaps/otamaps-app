import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GlobalSearch = () => {
  const { top } = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    'Figtree-Regular': require('../assets/fonts/Figtree-Regular.ttf'), 
    'Figtree-SemiBold': require('../assets/fonts/Figtree-SemiBold.ttf'),
    'Figtree-Bold': require('../assets/fonts/Figtree-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <ActivityIndicator />;
  }

  const [selectedFloor, setSelectedFloor] = useState(1);

  const handleFloorPress = (floor: number) => {
    setSelectedFloor(floor);
  };

  return (
    <View style={[styles.container, { top: top }]}>
      <View style={[styles.searchContainer]}>
        <MaterialCommunityIcons name="magnify" size={28} color="#000" />
        <TextInput
          style={[styles.textInput, { fontFamily: 'Figtree-Bold' }]} 
          placeholder="Search for Anything" 
          placeholderTextColor="#B5B5B5"
        />
      </View>
      <View style={styles.centerContainer}>
        <Pressable style={styles.button}>
          <MaterialIcons name="my-location" size={26} color="#000" />
        </Pressable>
        <View style={styles.spacer}/>
        <Pressable style={selectedFloor === 4 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(4)}>
          <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>4</Text>
        </Pressable>
        <View style={styles.spacer}/>
        <Pressable style={selectedFloor === 3 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(3)}>
          <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>3</Text>
        </Pressable>
        <View style={styles.spacer}/>
        <Pressable style={selectedFloor === 2 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(2)}>
          <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>2</Text>
        </Pressable>
        <View style={styles.spacer}/>
        <Pressable style={selectedFloor === 1 ? styles.buttonSelected : styles.button} onPress={() => handleFloorPress(1)}>
          <Text style={{ fontFamily: 'Figtree-SemiBold', fontSize: 16 }}>1</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default GlobalSearch;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchContainer: {
    backgroundColor: '#fff',
    height: 58,
    flex: 1,
    marginRight: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    fontSize: 16,
    color: '#000',
    flex: 1,
    fontFamily: 'Figtree-Regular',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  button: {
    padding: 8,
    paddingVertical: 12,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSelected: {
    padding: 8,
    borderRadius: 10,
    height: 48,
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#ddd',
    width: 52,
  },
  spacer: {
    height: 1,
    width: "80%",
    backgroundColor: '#ccc',
  },
});
