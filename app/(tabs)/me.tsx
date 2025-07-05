import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Me = () => {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between',  }}>
      <View style={{ flex: 1, width: '100%', alignItems: 'center', }}>
      <View style={styles.userContainer}>
        <Text>Me</Text>
      </View>

      <View style={styles.optionsContainer}>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold' }}>Option 1</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ccc' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold' }}>Asetukset</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ccc' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => router.push('/me/about')}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold' }}>Tietoja</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ccc' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => supabase.auth.signOut}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold' }}>Kirjaudu ulos</Text>
        </Pressable>
      </View>
      </View>

      <TouchableOpacity style={{ alignItems: 'center', }} onPress={() => Linking.openURL('https://streetsmarts.fi/')}>
        <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#777' }}>mahdollistanut</Text>
        <Image source={require('@/assets/images/streetsmarts.png')} resizeMode="contain" style={{ width: 120, height: 120 }} tintColor="#777" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

export default Me

const styles = StyleSheet.create({
  userContainer: {
    width: '90%',
    height: '20%',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  optionsContainer: {
    width: '90%',
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  optionContainer: {
    borderRadius: 16,
    padding: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  optionContainerPressed: {
    padding: 16,
    paddingVertical: 20,
    backgroundColor: '#f5f5f5',
  },
})
