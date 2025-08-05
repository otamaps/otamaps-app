import { configureGoogleSignIn, isGoogleSignInAvailable, signInWithGoogle } from '@/lib/googleAuth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState(true);

  useEffect(() => {
    // Configure Google Sign-In when component mounts
    configureGoogleSignIn();
    
    // Check if Google Sign-In is available
    const checkGoogleSignIn = async () => {
      const isAvailable = await isGoogleSignInAvailable();
      setGoogleSignInAvailable(isAvailable);
    };
    
    checkGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      // Navigation will be handled by the auth state listener in _layout.tsx
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      alert(`Sign in failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <StatusBar style="dark" backgroundColor="#fff" />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={{ marginTop: 16 }}>Signing in with Google...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tervetuloa takaisin</Text>
          <Text style={styles.subtitle}>Kirjaudu sisään jatkaaksesi sovellukseen</Text>
        </View>
      
      <View style={styles.buttonContainer}>
        <Pressable 
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed
          ]} 
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <View style={styles.googleButtonContent}>
            <Image 
              source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }} 
              style={styles.googleLogo}
            />
            <Text style={styles.googleButtonText}>Jatka Googlella</Text>
          </View>
        </Pressable>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>tai</Text>
          <View style={styles.divider} />
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.alternativeButton,
            pressed && styles.alternativeButtonPressed
          ]}
        >
          <Text style={styles.alternativeButtonText}>Muu kirjautuminen</Text>
          <Text style={styles.alternativeButtonSubtext}>Minulla ei ole @eduespoo.fi -tiliä</Text>
        </Pressable>
      </View>

      <Text style={{textAlign: 'center', marginTop: 16, color: '#666'}}>
        Kirjautumalla sisään hyväksyt{' '}
        <Text
          style={{color: 'blue'}}
          onPress={() => Linking.openURL('https://example.com/terms')}
        >
          Käyttöehdot
        </Text>{' '}
        ja{' '}
        <Text
          style={{color: 'blue'}}
          onPress={() => Linking.openURL('https://example.com/privacy')}
        >
          Tietosuojapolitiikan
        </Text>
      </Text>

    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 40,
    fontFamily: 'System',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#3c4043',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    marginHorizontal: 12,
    fontSize: 14,
    fontFamily: 'System',
  },
  alternativeButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  alternativeButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  alternativeButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
    marginBottom: 4,
  },
  alternativeButtonSubtext: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'System',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'System',
  },
});
