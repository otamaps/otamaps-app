import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface RoomItemProps {
  room: {
    id: string;
    name: string;
    capacity?: number;
    floor?: string;
    isAvailable?: boolean;
    isFavorite?: boolean;
    onFavoritePress?: () => void;
  };
  onPress?: () => void;
}

const RoomItem: React.FC<RoomItemProps> = ({ room, onPress }) => {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons 
          name={room.isAvailable ? 'meeting-room' : 'no-meeting-room'} 
          size={24} 
          color={room.isAvailable ? '#4A89EE' : '#B5B5B5'} 
        />
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.roomName} numberOfLines={1} ellipsizeMode="tail">
          {room.name}
        </Text>
        <View style={styles.metaContainer}>
          {room.floor && (
            <View style={styles.metaItem}>
              <MaterialIcons name="layers" size={14} color="#666" />
              <Text style={styles.metaText}>
                {room.floor}
              </Text>
            </View>
          )}
          {typeof room.capacity === 'number' && (
            <View style={styles.metaItem}>
              <MaterialIcons name="people" size={14} color="#666" />
              <Text style={styles.metaText}>
                {room.capacity} {room.capacity === 1 ? 'person' : 'people'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actionsContainer}>
        <Pressable 
          onPress={(e) => {
            e.stopPropagation();
            room.onFavoritePress?.();
          }}
          style={styles.favoriteButton}
        >
          <MaterialIcons 
            name={room.isFavorite ? 'star' : 'star-outline'} 
            size={24} 
            color={room.isFavorite ? '#FFD700' : '#B5B5B5'} 
          />
        </Pressable>
        <MaterialIcons 
          name="chevron-right" 
          size={24} 
          color="#B5B5B5" 
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    padding: 16,
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 16,
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: '#f8f8f8',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailsContainer: {
    flex: 1,
    marginRight: 12,
  },
  roomName: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 4,
    marginRight: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Figtree-Regular',
    color: '#666',
    marginLeft: 4,
  },
});

export default RoomItem;