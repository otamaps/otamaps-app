import { Floor } from '@/types'
import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

type Props = {
  item: Floor
  onPressFloor: (f: Floor) => void
}

const FloorItem: React.FC<Props> = ({ item, onPressFloor }) => (
  <Pressable
    style={styles.container}
    onPress={() => onPressFloor(item)}
  >
    {item.imageUrl
      ? <Image
          source={require('@/assets/images/floor0.png')}
          resizeMode="cover"
          style={styles.image}
        />
      : <View style={styles.placeholder} />
    }

    <View style={styles.infoContainer}>
      <Text style={styles.name}>{item.number}</Text>
      <Text style={styles.address}>{item.address}</Text>
    </View>
  </Pressable>
)

export default FloorItem

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 10,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
  },
  placeholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#ccc',
  },
  infoContainer: {
    padding: 16,
  },
  name: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  address: {
    fontSize: 14,
    color: '#808080',
    marginTop: 4,
  },
})