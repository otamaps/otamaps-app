import { supabase } from '@/lib/supabase';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const Floors = () => {
  const [floors, setFloors] = useState([]);

  React.useEffect(() => {
    const fetchFloors = async () => {
      const { data, error } = await supabase
        .from('floors')
        .select('*');

      if (error) {
        console.error('Error fetching buildings:', error);
      } else {
        setFloors(data);
      }
    };

    fetchFloors();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Floors</Text>
      </View>
      <ScrollView>
        {floors.map((floor) => (
          <View key={floor.id} style={styles.container}>
            <Text>{floor.id}</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{floor.number}</Text>
            <Text style={{ fontSize: 16, color: '#555' }}>Building {floor.building_id}</Text>
            {floor.room_ids.map((room) => (
              <Text key={room} style={{ fontSize: 14, color: '#777' }}>
                Room ID: {room} 
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default Floors;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ccc',
    width: '100%',
    height: '100%',
    borderRadius: 10,
    padding: 10,
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