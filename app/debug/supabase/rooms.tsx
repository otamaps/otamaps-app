import { supabase } from '@/lib/supabase';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);

  React.useEffect(() => {
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*');

      if (error) {
        console.error('Error fetching buildings:', error);
      } else {
        setRooms(data);
      }
    };

    fetchRooms();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Rooms</Text>
      </View>
      <ScrollView>
        {rooms.map((room) => (
          <View key={room.id} style={styles.container}>
            <Text>{room.id}</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{room.room_number}</Text>
            <Text style={{ fontSize: 16, color: '#555' }}>{room.title}</Text>
            <Text style={{ fontSize: 14, color: '#777' }}>{room.description}</Text>
            <Text style={{ fontSize: 14, color: '#777' }}>Seats: {room.seats}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 }}>
            <Text style={{ fontSize: 14, color: '#777', marginRight: 10 }}>Equipment:</Text>
            {room.equipment.map((equip) => (
              <Text key={equip} style={{ fontSize: 14, color: '#777' }}>{equip}, </Text>
            ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default Rooms;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ccc',
    flex: 1,
    borderRadius: 10,
    padding: 10,
    margin: 8,
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