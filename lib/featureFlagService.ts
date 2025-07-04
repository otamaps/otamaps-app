import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

const FEATURE_FLAG_STORAGE_KEY = '@feature_flags';

/**
 * Fetches all feature flags from Supabase and stores enabled ones in AsyncStorage
 * @returns Promise<FeatureFlag[]> - Array of all feature flags
 */
export const fetchAndStoreFeatureFlags = async (): Promise<FeatureFlag[]> => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('id, name, description, enabled');

    if (error) {
      console.error('Error fetching feature flags:', error);
      throw error;
    }

    if (data) {
      // Store enabled flags in AsyncStorage
      const enabledFlags = data.filter(flag => flag.enabled);
      await AsyncStorage.setItem(
        FEATURE_FLAG_STORAGE_KEY,
        JSON.stringify(enabledFlags)
      );
      
      return data;
    }

    return [];
  } catch (error) {
    console.error('Error in fetchAndStoreFeatureFlags:', error);
    throw error;
  }
};

/**
 * Gets all enabled feature flags from AsyncStorage
 * @returns Promise<FeatureFlag[]> - Array of enabled feature flags
 */
export const getEnabledFeatureFlags = async (): Promise<FeatureFlag[]> => {
  try {
    const flagsJson = await AsyncStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    return flagsJson ? JSON.parse(flagsJson) : [];
  } catch (error) {
    console.error('Error getting enabled feature flags:', error);
    return [];
  }
};

/**
 * Checks if a specific feature flag is enabled
 * @param flagName - The name of the feature flag to check
 * @returns Promise<boolean> - True if the flag exists and is enabled
 */
export const isFeatureEnabled = async (flagName: string): Promise<boolean> => {
  try {
    const enabledFlags = await getEnabledFeatureFlags();
    return enabledFlags.some(flag => flag.name === flagName && flag.enabled);
  } catch (error) {
    console.error(`Error checking if feature '${flagName}' is enabled:`, error);
    return false;
  }
};

/**
 * Clears all feature flags from AsyncStorage
 * @returns Promise<void>
 */
export const clearFeatureFlags = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FEATURE_FLAG_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing feature flags:', error);
    throw error;
  }
};