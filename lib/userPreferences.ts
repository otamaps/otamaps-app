import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isMissingScheduleSharingSchema,
  scheduleSharingUnavailableError,
} from "./scheduleSharingSchema";
import { supabase } from "./supabase";

export const CURRENT_ONBOARDING_VERSION = 1;
export const CURRENT_CONSENT_POLICY_VERSION = 2;

export type ProfileSource = "legacy" | "wilma";

export type UserPreferences = {
  user_id: string;
  profile_source: ProfileSource;
  onboarding_version: number;
  onboarding_completed_at: string | null;
  friend_location_enabled: boolean;
  schedule_sharing_enabled: boolean;
  anonymous_analytics_enabled: boolean;
  background_tracking_enabled: boolean;
  consent_policy_version: number;
  updated_at: string;
};

export type ConsentChoices = Pick<
  UserPreferences,
  | "friend_location_enabled"
  | "schedule_sharing_enabled"
  | "anonymous_analytics_enabled"
  | "background_tracking_enabled"
>;

const CACHE_PREFIX = "user_preferences_v1:";
const PREFERENCE_COLUMNS =
  "user_id,profile_source,onboarding_version,onboarding_completed_at,friend_location_enabled,schedule_sharing_enabled,anonymous_analytics_enabled,background_tracking_enabled,consent_policy_version,updated_at";
const LEGACY_PREFERENCE_COLUMNS =
  "user_id,profile_source,onboarding_version,onboarding_completed_at,friend_location_enabled,anonymous_analytics_enabled,background_tracking_enabled,consent_policy_version,updated_at";

type PreferenceWritePayload = {
  user_id: string;
  onboarding_version?: number;
  onboarding_completed_at?: string | null;
  friend_location_enabled: boolean;
  schedule_sharing_enabled: boolean;
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
    schedule_sharing_enabled: false,
    anonymous_analytics_enabled: false,
    background_tracking_enabled: false,
    consent_policy_version: CURRENT_CONSENT_POLICY_VERSION,
    updated_at: new Date(0).toISOString(),
  };
}

function normalizePreferences(
  preferences: Omit<UserPreferences, "schedule_sharing_enabled"> &
    Partial<Pick<UserPreferences, "schedule_sharing_enabled">>
): UserPreferences {
  return {
    ...preferences,
    schedule_sharing_enabled: preferences.schedule_sharing_enabled ?? false,
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
    return raw
      ? normalizePreferences(JSON.parse(raw) as UserPreferences)
      : null;
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
  payload: PreferenceWritePayload,
  legacySchema = false
): Promise<UserPreferences | null> {
  const { user_id: userId, ...allowedUpdates } = payload;
  const updates = legacySchema
    ? (({ schedule_sharing_enabled: _schedule, ...legacyUpdates }) =>
        legacyUpdates)(allowedUpdates)
    : allowedUpdates;
  const { data, error } = await supabase
    .from("user_preferences")
    .update(updates)
    .eq("user_id", userId)
    .select(legacySchema ? LEGACY_PREFERENCE_COLUMNS : PREFERENCE_COLUMNS)
    .maybeSingle<UserPreferences>();
  if (error) throw error;
  return data ? normalizePreferences(data) : null;
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
  let updated: UserPreferences | null;
  try {
    updated = await updateExistingPreferences(payload);
  } catch (error) {
    if (!isMissingScheduleSharingSchema(error)) throw error;
    if (payload.schedule_sharing_enabled) throw scheduleSharingUnavailableError();
    updated = await updateExistingPreferences(payload, true);
  }
  if (updated) return updated;

  let { data, error } = await supabase
    .from("user_preferences")
    .insert(payload)
    .select(PREFERENCE_COLUMNS)
    .single<UserPreferences>();

  if (error && isMissingScheduleSharingSchema(error)) {
    if (payload.schedule_sharing_enabled) throw scheduleSharingUnavailableError();
    const { schedule_sharing_enabled: _schedule, ...legacyPayload } = payload;
    const legacyResult = await supabase
      .from("user_preferences")
      .insert(legacyPayload)
      .select(LEGACY_PREFERENCE_COLUMNS)
      .single<UserPreferences>();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (!error && data) return normalizePreferences(data);

  // A Wilma identity can create the row between our UPDATE and INSERT.
  if (error?.code === "23505") {
    const retried = await updateExistingPreferences(payload);
    if (retried) return retried;
  }
  throw error ?? new Error("Tietosuoja-asetusten tallennus epäonnistui.");
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

  let { data, error } = await supabase
    .from("user_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<UserPreferences>();

  if (error && isMissingScheduleSharingSchema(error)) {
    const legacyResult = await supabase
      .from("user_preferences")
      .select(LEGACY_PREFERENCE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle<UserPreferences>();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    if (cached) return cached;
    throw error;
  }

  const preferences = data
    ? normalizePreferences(data)
    : defaultPreferences(userId);
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
      purpose: "weekly_schedule",
      previous: previous.schedule_sharing_enabled,
      next: next.schedule_sharing_enabled,
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
  const rows = decisions.map((decision) => ({
      user_id: userId,
      purpose: decision.purpose,
      granted: decision.next,
      policy_version: CURRENT_CONSENT_POLICY_VERSION,
    }));
  let { error } = await supabase.from("user_consent_events").insert(rows);

  if (error && isMissingScheduleSharingSchema(error)) {
    const scheduleDecision = decisions.find(
      (decision) => decision.purpose === "weekly_schedule"
    );
    if (scheduleDecision?.next) throw scheduleSharingUnavailableError();
    const legacyRows = rows.filter((row) => row.purpose !== "weekly_schedule");
    if (legacyRows.length === 0) return;
    const legacyResult = await supabase
      .from("user_consent_events")
      .insert(legacyRows);
    error = legacyResult.error;
  }
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
    schedule_sharing_enabled: choices.schedule_sharing_enabled,
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
    schedule_sharing_enabled:
      patch.schedule_sharing_enabled ?? previous.schedule_sharing_enabled,
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

export type TrackingConsentChoices = Pick<
  ConsentChoices,
  | "friend_location_enabled"
  | "anonymous_analytics_enabled"
  | "background_tracking_enabled"
>;

export async function getTrackingConsentChoices(): Promise<TrackingConsentChoices> {
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
