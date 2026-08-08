import { supabase } from '@/lib/supabase';
import type { AuthError, Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';

const SupabaseDebug = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const router = useRouter();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      setSession(data.session);
      setError(sessionError);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {error && <Text style={styles.text}>Error: {error.message}</Text>}
      {session ? (
        <Text style={styles.text}>Session Active: {JSON.stringify(session)}</Text>
      ) : (
        <Text style={styles.text}>No active session found.</Text>
      )}
      <TouchableOpacity
        style={styles.text}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.text}>Sign Out</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.text}
        onPress={() => router.push('/debug/supabase/login')}
      >
        <Text style={styles.text}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.text}
        onPress={() => router.push('/debug/supabase/buildings')}
      >
        <Text style={styles.text}>Buildings</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.text}
        onPress={() => router.push('/debug/supabase/floors')}
      >
        <Text style={styles.text}>Floors</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.text}
        onPress={() => router.push('/debug/supabase/rooms')}
      >
        <Text style={styles.text}>Rooms</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default SupabaseDebug;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  text: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
  },
});
