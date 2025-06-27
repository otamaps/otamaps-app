import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface FriendItemProps {
  friend: {
    id: string;
    name: string;
    status?: 'online' | 'offline' | 'busy' | 'local';
    lastSeen?: string | number; // Can be ISO string or timestamp
  };
  onPress?: () => void;
}

const formatLastSeen = (lastSeen?: string | number): string => {
  if (!lastSeen) return '';
  
  let date: Date;
  
  if (typeof lastSeen === 'string') {
    date = new Date(lastSeen);
  } else {
    date = new Date(lastSeen * 1000); // Convert seconds to milliseconds if needed
  }
  
  if (isNaN(date.getTime())) return 'Unknown';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const days = Math.floor(diffInSeconds / 86400);
  if (days < 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  // For older dates, show the actual date
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const FriendItem: React.FC<FriendItemProps> = ({ friend, onPress }) => {
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
          name="person" 
          size={24} 
          color={getStatusColor(friend.status)} 
        />
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.friendName} numberOfLines={1} ellipsizeMode="tail">
          {friend.name}
        </Text>
        <View style={styles.metaContainer}>
          {friend.status && (
            <View style={styles.metaItem}>
              <View 
                style={[
                  styles.statusIndicator, 
                  { backgroundColor: getStatusColor(friend.status) }
                ]} 
              />
              <Text style={styles.metaText}>
                {friend.status.charAt(0).toUpperCase() + friend.status.slice(1)}
              </Text>
            </View>
          )}
          {friend.lastSeen && (
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={14} color="#666" />
              <Text style={styles.metaText}>
                {formatLastSeen(friend.lastSeen)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons 
        name="chevron-right" 
        size={24} 
        color="#B5B5B5" 
      />
    </Pressable>
  );
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'online':
      return '#4CAF50';
    case 'busy':
      return '#F44336';
    default:
      return '#9E9E9E';
  }
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
    marginRight: 8,
  },
  friendName: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    color: '#333',
    marginBottom: 4,
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
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontFamily: 'Figtree-Regular',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});

export default FriendItem;