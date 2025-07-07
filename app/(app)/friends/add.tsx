import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const AddFriendScreen = () => {
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = () => {
    if (code.length === 6) {
      setIsSearching(true);
      // Always show not found after a short delay
      setTimeout(() => {
        setIsSearching(false);
      }, 500);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen 
        options={{ 
          title: 'Add Friend',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#4A89EE" />
            </Pressable>
          )
        }} 
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>Enter Friend's Code</Text>
        <Text style={styles.subtitle}>Ask your friend for their 6-digit code</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            selectionColor="#4A89EE"
          />
          <Pressable 
            style={[styles.searchButton, code.length !== 6 && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={code.length !== 6 || isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialIcons name="search" size={24} color="white" />
            )}
          </Pressable>
        </View>
        
        {code.length === 6 && !isSearching && (
          <View style={styles.resultContainer}>
            <MaterialIcons name="person-off" size={48} color="#999" />
            <Text style={styles.resultText}>No friend found</Text>
            <Text style={styles.hintText}>Please check the code and try again</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Figtree-SemiBold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Figtree-Medium',
    backgroundColor: '#f8f9fa',
    marginRight: 12,
    textAlign: 'center',
    letterSpacing: 2,
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#4A89EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  resultContainer: {
    alignItems: 'center',
    padding: 24,
  },
  resultText: {
    fontSize: 18,
    fontFamily: 'Figtree-SemiBold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default AddFriendScreen;