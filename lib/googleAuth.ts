import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

// Define the expected response type
interface GoogleSignInResponse {
  idToken: string;
  user: {
    email: string;
    id: string;
    name: string;
    photo: string | null;
    familyName: string | null;
    givenName: string | null;
  };
}

// Configure Google Sign-In
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: '587558103382-pq3t39bef7jsq7vvr8c1t044gaeqomgh.apps.googleusercontent.com', // TODO: Replace with your web client ID from Google Cloud Console
    iosClientId: '587558103382-esnjsvgl9is8co4ottb5i1p8rdj9drn7.apps.googleusercontent.com', // TODO: Replace with your iOS client ID if needed
    offlineAccess: false,
  });
}; 

export const signInWithGoogle = async () => {
  try {
    // Check if device has Google Play Services (Android)
    await GoogleSignin.hasPlayServices();
    
    // Perform sign-in
    await GoogleSignin.signOut(); // Sign out any existing session first
    
    // Sign in and get tokens
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const { accessToken } = await GoogleSignin.getTokens();
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    // Sign in to Supabase using the access token
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export const isGoogleSignInAvailable = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    return true;
  } catch (error) {
    console.warn('Google Play Services not available', error);
    return false;
  }
}; 
