import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const COLORS = [
  '#ff595e', '#ff924c', '#ffca3a', '#c5ca30', '#8ac926',
  '#52a675', '#1982c4', '#4267ac', '#6a4c93', '#b5a6c9'
];

const Edit = () => {
  const [name, setName] = useState('');
  const [userClass, setUserClass] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [classError, setClassError] = useState('');

  const validateClass = (text: string) => {
    // Only allow numbers and letters, max 3 characters
    const cleaned = text.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
    
    // If more than 3 characters, don't update
    if (cleaned.length > 3) return;
    
    // Update the input value
    setUserClass(cleaned);
    
    // Validate the format only when we have exactly 3 characters
    if (cleaned.length === 3) {
      if (/^\d{2}[A-Za-z]$/.test(cleaned)) {
        setClassError('');
      } else {
        setClassError('Syötä luokka muodossa 24A');
      }
    } else if (cleaned.length > 0) {
      // Show error if we have some input but not enough
      setClassError('Syötä 2 numeroa ja 1 kirjain');
    } else {
      setClassError('');
    }
  };

  useEffect(() => {
    // Load current user data
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // In a real app, you would fetch the user's current data here
        // For now, we'll use placeholder data
        setName(user.user_metadata?.full_name || '');
        setUserClass(user.user_metadata?.class || '');
        setSelectedColor(user.user_metadata?.color || COLORS[0]);
      }
    };
    
    loadUserData();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          class: userClass.trim(),
          color: selectedColor
        }
      });

      if (error) throw error;
      
      // Update the display name in the auth user
      await supabase.auth.updateUser({
        data: { full_name: name.trim() }
      });
      
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.label}>Nimi</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Kirjoita nimesi"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Luokka</Text>
          <TextInput
            style={[styles.input, classError && styles.inputError]}
            value={userClass}
            onChangeText={validateClass}
            placeholder="Esimerkiksi 24Q"
            placeholderTextColor="#999"
            maxLength={3}
            autoCapitalize="characters"
          />
          {classError ? <Text style={styles.errorText}>{classError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Profiilin väri</Text>
          <View style={styles.colorsContainer}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColor
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && (
                  <Ionicons name="checkmark" size={24} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.previewSection}>
          <Text style={styles.label}>Esikatselu</Text>
          <View style={styles.previewContainer}>
            <View 
              style={[styles.previewAvatar, { backgroundColor: selectedColor }]}
            >
              <Text style={styles.avatarText}>
                {name ? name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View style={styles.previewTextContainer}>
              <Text style={styles.previewName}>{name || 'Nimi'}</Text>
              <Text style={styles.previewClass}>{userClass || 'Luokka'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Tallennetaan...' : 'Tallenna muutokset'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Figtree-Regular',
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    width: '100%',
    marginHorizontal: -5,
    height: 120,
  },
  colorOption: {
    width: '18%',
    aspectRatio: 1,
    height: 50,
    maxWidth: 60,
    minWidth: 50,
    borderRadius: 30,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
    transform: [{ scale: 1.1 }],
  },
  previewSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  previewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Figtree-Bold',
  },
  previewTextContainer: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontFamily: 'Figtree-SemiBold',
    marginBottom: 4,
  },
  previewClass: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Figtree-Regular',
  },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Figtree-SemiBold',
  },
  buttonDisabled: {
    backgroundColor: '#A0C3FF',
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Figtree-Regular',
  },
});

export default Edit;
