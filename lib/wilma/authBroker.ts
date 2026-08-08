import * as SecureStore from "expo-secure-store";
import { supabase } from "../supabase";
import { clearAll, saveCredentials, saveSession } from "./graphqlClient";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_OTAMAPS_API_URL || "https://api.otamaps.fi"
).replace(/\/$/, "");
const PENDING_LINK_KEY = "wilma_legacy_link_attempt";

export const WILMA_PRIMARY_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED !== "false";

export type WilmaSessionExchange = {
  kind: "session";
  tokenHash: string;
  expectedUserId: string;
  wilmaSessionToken: string;
};

export type WilmaLegacyMatch = {
  kind: "legacy_match";
  attemptToken: string;
};

export type WilmaStartResult = WilmaSessionExchange | WilmaLegacyMatch;

type WilmaLinkedSession = {
  kind: "linked";
  expectedUserId: string;
  wilmaSessionToken: string;
};

type PendingLink = {
  attemptToken: string;
  username: string;
  password: string;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

async function postJson<T>(
  path: string,
  body: Record<string, string>,
  accessToken?: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json()) as T & ApiErrorBody;
    if (!response.ok) {
      const error = new Error(
        payload.error?.message || "Kirjautumispalvelu ei ole käytettävissä."
      );
      (error as Error & { code?: string }).code = payload.error?.code;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Kirjautumispalvelun yhteys aikakatkaistiin.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function startWilmaAuthentication(
  username: string,
  password: string
): Promise<WilmaStartResult> {
  return postJson<WilmaStartResult>("/v1/auth/wilma/start", {
    username,
    password,
  });
}

export function createWilmaAccount(
  attemptToken: string
): Promise<WilmaSessionExchange> {
  return postJson<WilmaSessionExchange>("/v1/auth/wilma/create", {
    attemptToken,
  });
}

export async function finishWilmaSupabaseExchange(
  exchange: WilmaSessionExchange,
  username: string,
  password: string
) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: exchange.tokenHash,
    type: "email",
  });
  if (error) throw error;
  if (!data.user || data.user.id !== exchange.expectedUserId) {
    await supabase.auth.signOut();
    throw new Error("Supabase-istunnon käyttäjä ei vastannut Wilma-tunnistetta.");
  }
  try {
    await Promise.all([
      saveSession(exchange.wilmaSessionToken),
      saveCredentials(username, password),
      clearPendingLegacyLink(),
    ]);
  } catch (error) {
    await Promise.allSettled([
      supabase.auth.signOut(),
      clearAll(),
      clearPendingLegacyLink(),
    ]);
    throw error;
  }
  return data;
}

export async function savePendingLegacyLink(
  attemptToken: string,
  username: string,
  password: string
): Promise<void> {
  await SecureStore.setItemAsync(
    PENDING_LINK_KEY,
    JSON.stringify({ attemptToken, username, password } satisfies PendingLink),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  );
}

export async function getPendingLegacyLink(): Promise<PendingLink | null> {
  const raw = await SecureStore.getItemAsync(PENDING_LINK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingLink;
  } catch {
    await clearPendingLegacyLink();
    return null;
  }
}

export async function clearPendingLegacyLink(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_LINK_KEY);
}

export async function completePendingLegacyLink(
  accessToken?: string
): Promise<boolean> {
  const pending = await getPendingLegacyLink();
  if (!pending) return false;
  const token =
    accessToken || (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Vanhan OtaMaps-tilin istunto puuttuu.");

  try {
    const linked = await postJson<WilmaLinkedSession>(
      "/v1/auth/wilma/link-legacy",
      { attemptToken: pending.attemptToken },
      token
    );
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;
    if (!currentUserId || currentUserId !== linked.expectedUserId) {
      throw new Error(
        "Yhdistetty OtaMaps-tili ei vastannut kirjautunutta käyttäjää."
      );
    }
    await Promise.all([
      saveSession(linked.wilmaSessionToken),
      saveCredentials(pending.username, pending.password),
      clearPendingLegacyLink(),
    ]);
    return true;
  } catch (error) {
    await Promise.allSettled([
      supabase.auth.signOut(),
      clearAll(),
      clearPendingLegacyLink(),
    ]);
    throw error;
  }
}

export async function connectWilmaAccount(
  username: string,
  password: string
): Promise<WilmaLinkedSession> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw error ?? new Error("OtaMaps-istunto puuttuu.");
  }

  const linked = await postJson<WilmaLinkedSession>(
    "/v1/auth/wilma/connect",
    { username: username.trim(), password },
    session.access_token
  );
  if (linked.expectedUserId !== session.user.id) {
    throw new Error("Yhdistetty Wilma-tili ei vastannut OtaMaps-käyttäjää.");
  }
  await Promise.all([
    saveSession(linked.wilmaSessionToken),
    saveCredentials(username.trim(), password),
    clearPendingLegacyLink(),
  ]);
  return linked;
}
