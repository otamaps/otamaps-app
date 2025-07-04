import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FriendBlobProps {
  onClick: (friendId: string) => void;
  friendId: string;
  name: string;
}

const FriendBlob: React.FC<FriendBlobProps> = ({ onClick, friendId, name }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={() => onClick(friendId)}>
      <View style={styles.circle}>
        <Text style={styles.name}>{name}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 8,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default FriendBlob;
