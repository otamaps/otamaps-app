import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export default function Who() {
  const [ username, setUsername ] = useState("");


  return(
    <View>
      <Text>Nimi:</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
      />
    </View>
  )
}