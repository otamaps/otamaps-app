import { generateCode } from "@/components/functions/codeGen";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { clearPendingLegacyLink } from "./wilma/authBroker";
import { logoutMutation } from "./wilma/graphqlClient";

const DEFAULT_WEB_CLIENT_ID =
  "587558103382-pq3t39bef7jsq7vvr8c1t044gaeqomgh.apps.googleusercontent.com";
const DEFAULT_IOS_CLIENT_ID =
  "587558103382-esnjsvgl9is8co4ottb5i1p8rdj9drn7.apps.googleusercontent.com";

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || DEFAULT_IOS_CLIENT_ID;

const getDisplayName = (user: User) => {
  const fromMetadata =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.given_name;

  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata.trim();
  }

  return user.email?.split("@")[0] || "Käyttäjä";
};

const ensureUserProfile = async (user: User) => {
  if (!user.email) {
    return;
  }

  const normalizedEmail = user.email.toLowerCase().trim();

  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: normalizedEmail,
      name: getDisplayName(user),
      class: user.user_metadata?.class || "",
      color: user.user_metadata?.color || "#4A89EE",
      code: generateCode(normalizedEmail),
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) {
    throw error;
  }
};

const toReadableError = (error: unknown): Error => {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return new Error("Google-kirjautuminen peruttiin.");
      case statusCodes.IN_PROGRESS:
        return new Error("Google-kirjautuminen on jo kaynnissa.");
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return new Error("Google Play Services ei ole saatavilla laitteessa.");
      default:
        return new Error(error.message || "Google-kirjautuminen epaonnistui.");
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Google-kirjautuminen epaonnistui.");
};

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
};

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();

    const { idToken } = await GoogleSignin.getTokens();

    if (!idToken) {
      throw new Error("Google idToken puuttuu kirjautumisesta.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await ensureUserProfile(data.user);
    }

    return data;
  } catch (error) {
    const normalizedError = toReadableError(error);
    console.error("Google Sign-In Error:", normalizedError);
    throw normalizedError;
  }
};

export const signOutGoogleAndSupabase = async () => {
  const { error } = await supabase.auth.signOut();

  await Promise.allSettled([logoutMutation(), clearPendingLegacyLink()]);

  try {
    await GoogleSignin.signOut();
  } catch (googleError) {
    console.warn("Google local sign-out failed", googleError);
  }

  if (error) {
    throw error;
  }
};

export const isGoogleSignInAvailable = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    return true;
  } catch (error) {
    console.warn("Google Play Services not available", error);
    return false;
  }
};
