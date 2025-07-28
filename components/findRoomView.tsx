import { isFeatureEnabled } from '@/lib/featureFlagService';
import { Entypo, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Room = {
  id: string;
  room_number?: number | null;
  title?: string | null;
  description?: string | null;
  seats?: number | null;
  type?: string | null;
  equipment?: any | null; // Or a more specific type if the structure of equipment is known
  wilma_id?: string | null;
  bookable?: string | null;
  image_url?: string | null;
  created_at?: string | null; // Or Date
  schedule?: string | null;
  geometry?: any | null; // Or a more specific type for GeoJSON, for example
  color: string;
};

interface FindRoomViewProps {
  room?: Partial<Room>; // room is optional and can be an incomplete Room object
}

interface FindRoomViewProps {
  room?: Partial<Room>; // room is optional and can be an incomplete Room object
  onBook?: () => void; // Add the onBook prop here
}

const FindRoomView = ({ room = {}, onBook }: FindRoomViewProps) => {
  const [isBookingEnabled, setIsBookingEnabled] = useState(false);

  useEffect(() => {
    const checkBookingFeature = async () => {
      const enabled = await isFeatureEnabled('booking');
      setIsBookingEnabled(enabled);
    };
    checkBookingFeature();
  }, []);
  return (
    <Pressable style={({pressed}) => [
      { opacity: pressed ? 0.7 : 1 },
      styles.container,
    ]}>
      <View style={styles.leftContainer}>
        <View style={{ flexDirection: 'row', }}>
          <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold' }}>{room.room_number || '2025'} </Text>
          <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold' }}>{room.title || 'Room Name'}</Text>
        </View>
        <Text style={{ padding: 6, paddingLeft: 0, fontSize: 16, }}>{room.seats || '15'} seats</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
          <FlatList
            data={Array.isArray(room.equipment) ? room.equipment : []}
            renderItem={({ item }) => (
              <Icon name={item} />
            )}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </View>
      <View style={styles.rightContainer}>
        { room.image_url ? (
          <Image
            source={{ uri: room.image_url }}
            style={[
              { width: '100%', backgroundColor: '#ccc' },
              isBookingEnabled 
                ? { height: '75%', borderTopRightRadius: 10 }
                : { height: '100%', borderTopRightRadius: 10, borderBottomRightRadius: 10 }
            ]}
            resizeMode="cover"
          />
        ) : (
          <View style={[
            styles.imagePlaceholder,
            !isBookingEnabled && { height: '100%', borderBottomRightRadius: 10 }
          ]} />
        )}
        {isBookingEnabled && (
          <Pressable 
            style={({pressed}) => [
              { opacity: pressed ? 0.7 : 1 },
              styles.bookButton
            ]} 
            hitSlop={10}
            onPress={onBook} // Call onBook when pressed
          >
            <Text style={styles.bookText}>Book</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
export default FindRoomView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    flexDirection: 'row',
    width: '100%',
  },
  leftContainer: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 12,
    paddingLeft: 14,
    paddingRight: 0,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    height: '100%',
    width: '60%',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c33',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    height: 180,
    width: '40%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '75%',
    backgroundColor: '#ccc',
    borderTopRightRadius: 10,
  },
  bookButton: {
    alignItems: 'center',
    height: '25%',
    width: '100%',
    overflow: 'visible',
    justifyContent: 'center',
    borderBottomRightRadius: 10,
    backgroundColor: '#4A89EE',
  },
  bookText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

const Icon = ({ name }: { name: string }) => {
  switch (name) {
    case 'blackboard':
      return <Entypo name="blackboard" size={22} color="black" />;
    case 'tv':
      return <MaterialIcons name="tv" size={22} color="black" />;
    case 'kitchen':
      return <MaterialIcons name="kitchen" size={22} color="black" />;
    case '3d':
      return <MaterialCommunityIcons name="printer-3d" size={22} color="black" />;
    case 'projector':
      return <MaterialCommunityIcons name="projector" size={22} color="black" />;
  }
}