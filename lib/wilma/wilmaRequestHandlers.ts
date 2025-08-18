import * as SecureStore from "expo-secure-store";
import { getWilmaToken } from "./owLoginHandler";

const MESSAGES_KEY = "wilma_messages";
const MESSAGES_TIME_KEY = "wilma_messages_time";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function getWilmaMessages(): Promise<any> {
  const now = Date.now();
  const lastFetchStr = await SecureStore.getItemAsync(MESSAGES_TIME_KEY);
  const lastFetch = lastFetchStr ? Number(lastFetchStr) : 0;
  const cached = await SecureStore.getItemAsync(MESSAGES_KEY);

  // Use cache if less than 30 min old and exists
  if (cached && lastFetch && now - lastFetch < CACHE_DURATION_MS) {
    try {
      return JSON.parse(cached);
    } catch {
      // fallback to refetch
    }
  }

  const token = await getWilmaToken();
  if (!token) throw new Error("Wilma token not found. Please login first.");

  const url = "https://wilma.otawilma.fi/api/messages/inbox/?limit=100";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "token": token,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-GPC": "1",
    "Priority": "u=4",
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    referrer: "https://otawilma.fi/",
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Wilma messages fetch failed: ${response.status} ${response.statusText}`);
  }
  const messages = await response.json();
  // Save to cache
  await SecureStore.setItemAsync(MESSAGES_KEY, JSON.stringify(messages));
  await SecureStore.setItemAsync(MESSAGES_TIME_KEY, String(now));
  return messages;
}

export async function clearWilmaMessagesCache() {
  await SecureStore.deleteItemAsync(MESSAGES_KEY);
  await SecureStore.deleteItemAsync(MESSAGES_TIME_KEY);
}
