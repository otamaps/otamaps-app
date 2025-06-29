import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const FavouriteRooms = () => {
  return (
    <View style={{ flex: 1, }}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Favourite Rooms</Text>
      </View>
      <ScrollView>
      </ScrollView>
    </View>
  );
}

export default FavouriteRooms;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ccc',
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  bookButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
  },
  bookText: {
    color: '#000',
  },
  topBar: {
    width: '100%',
    height: 60,
    backgroundColor: '#4A89EE',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
  },
  topBarText: {
    fontSize: 22,
    fontWeight: 'semibold',
    color: '#fff',
    marginLeft: 16,
  },
});