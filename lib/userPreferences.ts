import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export const CURRENT_ONBOARDING_VERSION = 1;
export const CURRENT_CONSENT_POLICY_VERSION = 1;

export type ProfileSource = "legacy" | "wilma";

export type UserPreferences = {
  user_id: string;
  profile_source: ProfileSource;
  onboarding_version: number;
  onboarding_completed_at: string | null;
  friend_location_enabled: boolean;
  anonymous_analytics_enabled: boolean;
  background_tracking_enabled: boolean;
  consent_policy_version: number;
  updated_at: string;
};

export type ConsentChoices = Pick<
  UserPreferences,
  | "friend_location_enabled"
  | "anonymous_analytics_enabled"
  | "background_tracking_enabled"
>;

const CACHE_PREFIX = "user_preferences_v1:";
const PREFERENCE_COLUMNS =
  "user_id,profile_source,onboarding_version,onboarding_completed_at,friend_location_enabled,anonymous_analytics_enabled,background_tracking_enabled,consent_policy_version,updated_at";

type PreferenceWritePayload = {
  user_id: string;
  onboarding_version?: number;
  onboarding_completed_at?: string | null;
  friend_location_enabled: boolean;
  anonymous_analytics_enabled: boolean;
  background_tracking_enabled: boolean;
  consent_policy_version: number;
  updated_at: string;
};

function defaultPreferences(userId: string): UserPreferences {
  return {
    user_id: userId,
    profile_source: "legacy",
    onboarding_version: 0,
    onboarding_completed_at: null,
    friend_location_enabled: false,
    anonymous_analytics_enabled: false,
    background_tracking_enabled: false,
    consent_policy_version: CURRENT_CONSENT_POLICY_VERSION,
    updated_at: new Date(0).toISOString(),
  };
}

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

async function readCachedPreferences(
  userId: string
): Promise<UserPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as UserPreferences) : null;
  } catch {
    return null;
  }
}

async function cachePreferences(preferences: UserPreferences): Promise<void> {
  await AsyncStorage.setItem(
    cacheKey(preferences.user_id),
    JSON.stringify(preferences)
  );
}

async function updateExistingPreferences(
  payload: PreferenceWritePayload
): Promise<UserPreferences | null> {
  const { user_id: userId, ...allowedUpdates } = payload;
  const { data, error } = await supabase
    .from("user_preferences")
    .update(allowedUpdates)
    .eq("user_id", userId)
    .select(PREFERENCE_COLUMNS)
    .maybeSingle<UserPreferences>();
  if (error) throw error;
  return data;
}

/**
 * Keep profile_source server-managed while supporting both Wilma users (whose
 * preference row is created by a database trigger) and older legacy users.
 *
 * A Supabase upsert maps to one INSERT ... ON CONFLICT request. That request is
 * rejected when INSERT/UPDATE are intentionally granted per-column instead of
 * for the whole table. Use the permitted UPDATE or INSERT operation directly.
 */
async function writePreferences(
  payload: PreferenceWritePayload
): Promise<UserPreferences> {
  const updated = await updateExistingPreferences(payload);
  if (updated) return updated;

  const { data, error } = await supabase
    .from("user_preferences")
    .insert(payload)
    .select(PREFERENCE_COLUMNS)
    .single<UserPreferences>();

  if (!error) return data;

  // A Wilma identity can create the row between our UPDATE and INSERT.
  if (error.code === "23505") {
    const retried = await updateExistingPreferences(payload);
    if (retried) return retried;
  }
  throw error;
}

async function requireUserId(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.user.id) {
    throw error ?? new Error("Käyttäjä ei ole kirjautunut sisään.");
  }
  return session.user.id;
}

export async function getUserPreferences(options: {
  forceRefresh?: boolean;
} = {}): Promise<UserPreferences> {
  const userId = await requireUserId();
  const cached = await readCachedPreferences(userId);
  if (!options.forceRefresh && cached) return cached;

  const { data, error } = await supabase
    .from("user_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<UserPreferences>();

  if (error) {
    if (cached) return cached;
    throw error;
  }

  const preferences = data ?? defaultPreferences(userId);
  await cachePreferences(preferences);
  return preferences;
}

async function recordConsentEvents(
  userId: string,
  previous: ConsentChoices,
  next: ConsentChoices,
  recordUnchanged = false
): Promise<void> {
  const decisions = [
    {
      purpose: "friend_location",
      previous: previous.friend_location_enabled,
      next: next.friend_location_enabled,
    },
    {
      purpose: "anonymous_crowd_analytics",
      previous: previous.anonymous_analytics_enabled,
      next: next.anonymous_analytics_enabled,
    },
    {
      purpose: "background_tracking",
      previous: previous.background_tracking_enabled,
      next: next.background_tracking_enabled,
    },
  ].filter((decision) => recordUnchanged || decision.previous !== decision.next);

  if (decisions.length === 0) return;
  const { error } = await supabase.from("user_consent_events").insert(
    decisions.map((decision) => ({
      user_id: userId,
      purpose: decision.purpose,
      granted: decision.next,
      policy_version: CURRENT_CONSENT_POLICY_VERSION,
    }))
  );
  if (error) throw error;
}

export async function saveOnboardingChoices(
  choices: ConsentChoices
): Promise<UserPreferences> {
  const userId = await requireUserId();
  const previous = await getUserPreferences({ forceRefresh: true });
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    onboarding_version: CURRENT_ONBOARDING_VERSION,
    onboarding_completed_at: now,
    friend_location_enabled: choices.friend_location_enabled,
    anonymous_analytics_enabled: choices.anonymous_analytics_enabled,
    background_tracking_enabled: choices.background_tracking_enabled,
    consent_policy_version: CURRENT_CONSENT_POLICY_VERSION,
    updated_at: now,
  };
  const data = await writePreferences(payload);

  await recordConsentEvents(userId, previous, choices, true);
  await cachePreferences(data);
  return data;
}

export async function updateConsentChoices(
  patch: Partial<ConsentChoices>
): Promise<UserPreferences> {
  const previous = await getUserPreferences({ forceRefresh: true });
  const next: ConsentChoices = {
    friend_location_enabled:
      patch.friend_location_enabled ?? previous.friend_location_enabled,
    anonymous_analytics_enabled:
      patch.anonymous_analytics_enabled ?? previous.anonymous_analytics_enabled,
    background_tracking_enabled:
      patch.background_tracking_enabled ?? previous.background_tracking_enabled,
  };
  const now = new Date().toISOString();
  const data = await writePreferences({
    user_id: previous.user_id,
    onboarding_version: previous.onboarding_version,
    onboarding_completed_at: previous.onboarding_completed_at,
    ...next,
    consent_policy_version: CURRENT_CONSENT_POLICY_VERSION,
    updated_at: now,
  });

  await recordConsentEvents(previous.user_id, previous, next);
  await cachePreferences(data);
  return data;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const preferences = await getUserPreferences({ forceRefresh: true });
  return preferences.onboarding_version >= CURRENT_ONBOARDING_VERSION;
}

export async function getTrackingConsentChoices(): Promise<ConsentChoices> {
  const preferences = await getUserPreferences();
  return {
    friend_location_enabled: preferences.friend_location_enabled,
    anonymous_analytics_enabled: preferences.anonymous_analytics_enabled,
    background_tracking_enabled: preferences.background_tracking_enabled,
  };
}

export async function clearCurrentUserPreferencesCache(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user.id) {
    await AsyncStorage.removeItem(cacheKey(session.user.id));
  }
}
