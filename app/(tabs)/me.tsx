import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const Me = () => {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', marginTop: 40, }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, width: '100%', alignItems: 'center', }}>
      <View style={styles.userContainer}>
        <View style={styles.userRow}>
          <Image
            source={{ uri: 'https://api.dicebear.com/9.x/initials/webp?seed=Rene%20Saarikko' }}
            style={styles.profilePicture}
          />
          <View style={styles.userInfo}>
            <Text style={[styles.nameText, { fontSize: 24 }]}>Rene Saarikko</Text>
            <Text style={[styles.nameText, { fontSize: 16 }]}>24M</Text>
          </View>
        </View>
      </View>

      <View style={styles.optionsContainer}>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer, 

            pressed && styles.optionContainerPressed
          ]}
          onPress={() => router.push('/me/edit')}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#444' }}>Muokkaa tietojani</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ddd' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => router.push('/me/wilma')}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#444' }}>Yhdistä Wilma-tili</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ddd' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#444' }}>Asetukset</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ddd' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => router.push('/me/ohje')}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#444' }}>Ohje</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ddd' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => router.push('/me/about')}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#444' }}>Tietoja</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#ddd' }}/>
        <Pressable 
          style={({ pressed }) => [
            styles.optionContainer,
            pressed && styles.optionContainerPressed
          ]}
          onPress={() => {
            supabase.auth.signOut();
            router.push('/');
          }}
        >
          <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#ff3f3f' }}>Kirjaudu ulos</Text>
        </Pressable>
      </View>
      </View>

      <TouchableOpacity style={{ alignItems: 'center', }} onPress={() => Linking.openURL('https://streetsmarts.fi/')}>
        <Text style={{ fontSize: 16, fontFamily: 'Figtree-SemiBold', color: '#999' }}>mahdollistanut</Text>
        <Image source={require('@/assets/images/streetsmarts.png')} resizeMode="contain" style={{ width: 120, height: 80, marginVertical: 8, }} tintColor="#999" />
      </TouchableOpacity>
    </View>
  )
}

export default Me

const styles = StyleSheet.create({
  userContainer: {
    width: '90%',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  optionsContainer: {
    width: '90%',
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicture: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontFamily: 'Figtree-SemiBold',
    fontSize: 16,
    color: '#333',
  },
})
