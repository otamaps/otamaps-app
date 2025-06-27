import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const FriendItem = (item) => {
  return (
    <Pressable style={styles.container}>
      <View style={styles.leftContainer}>
        <View style={styles.pfp}/>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>
        </View> 
      </View>
    </Pressable>
  )
}

export default FriendItem

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 10,
    marginHorizontal: 16,
  },
  pfp: {
    width: 50,
    height: 50,
    borderRadius: 50,
    backgroundColor: '#ccc',
  },
  textContainer: {
    marginLeft: 16,
    justifyContent: 'center',
    flexDirection: 'column',
  },
  name: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  leftContainer: {
    flexDirection: 'row',
  }
})