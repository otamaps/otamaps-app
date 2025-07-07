import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

interface FriendBlobProps {
  onClick: (friendId: string) => void;
  friendId: string;
  name: string;
}

const FriendBlob: React.FC<FriendBlobProps> = ({ onClick, friendId, name }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onClick(friendId)}
      activeOpacity={0.7}
    >
      <View style={styles.circle}>
        <Image
          source={{ uri: `https://api.dicebear.com/9.x/initials/webp?seed=${encodeURIComponent(name)}&scale=80` }}
          style={styles.profilePicture}
          resizeMode="cover"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'visible',
  },
  circle: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
  },
});

export default FriendBlob;
