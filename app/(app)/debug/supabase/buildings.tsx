import { supabase } from '@/lib/supabase';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const Buildings = () => {
  const [buildings, setBuildings] = useState([]);

  React.useEffect(() => {
    const fetchBuildings = async () => {
      const { data, error } = await supabase
        .from('buildings')
        .select('*');

      if (error) {
        console.error('Error fetching buildings:', error);
      } else {
        setBuildings(data);
      }
    };

    fetchBuildings();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Buildings</Text>
      </View>
      <ScrollView>
        {buildings.map((building) => (
          <View key={building.id} style={styles.container}>
            <Text>{building.id}</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{building.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default Buildings;

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