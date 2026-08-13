// friendsHandler.ts

import { getUser } from "@/lib/getUserHandle";
import { getRoomIdFromBleId } from "@/lib/idTranslation";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "cached_friends";

export type Friend = {
  id: string;
  name: string;
  class: string;
  code: string;
  color: string;
  lastSeen: string | null;
  location: [number, number] | null;
  floor: number | null;
  status: string;
  user_friendly_location?: string;
};

type FriendLocationRow = {
  user_id: string;
  x: number | null;
  y: number | null;
  floor: number | null;
  updated_at: string | null;
  beacons: unknown;
};

type FriendProfileRow = {
  id: string;
  name: string;
  class: string;
  code: string;
  color: string;
};

function strongestBeaconId(beacons: unknown): string | null {
  if (!Array.isArray(beacons) || beacons.length === 0) return null;
  const candidates = beacons.filter(
    (beacon): beacon is { id: string | number; distance: number } =>
      Boolean(beacon) &&
      typeof beacon === "object" &&
      "id" in beacon &&
      "distance" in beacon &&
      typeof beacon.distance === "number"
  );
  if (candidates.length === 0) return null;
  return String(
    candidates.reduce((closest, candidate) =>
      candidate.distance < closest.distance ? candidate : closest
    ).id
  );
}

// fetch and combine from Supabase
const fetchFriendsFromSupabase = async (): Promise<Friend[]> => {
  const user = await getUser();
  if (!user) return [];

  const { data: relations, error: relationError } = await supabase
    .from("relations")
    .select("subject,object")
    .eq("status", "friends")
    .or(`subject.eq.${user.id},object.eq.${user.id}`);
  if (relationError) throw relationError;

  const friendIds = Array.from(
    new Set(
      (relations ?? []).map((relation) =>
        relation.subject === user.id ? relation.object : relation.subject
      )
    )
  ).filter((id) => id !== user.id);
  if (friendIds.length === 0) return [];

  const [profileResult, locationResult] = await Promise.all([
    supabase
      .from("users_ff")
      .select("id,name,class,code,color")
      .in("id", friendIds)
      .returns<FriendProfileRow[]>(),
    supabase
      .from("locations")
      .select("user_id,x,y,floor,updated_at,beacons")
      .in("user_id", friendIds)
      .returns<FriendLocationRow[]>(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (locationResult.error) throw locationResult.error;
  const users = profileResult.data ?? [];
  const locations = locationResult.data ?? [];

  //console.log("Locations:", locations);
  const combined: Friend[] = await Promise.all(
    (users ?? []).map(async (user) => {
      const location = (locations ?? []).find((loc) => loc.user_id === user.id);
      const beaconId = strongestBeaconId(location?.beacons);
      const friendlyLocation = beaconId
        ? await getRoomIdFromBleId(beaconId)
        : undefined;
      const hasCoordinates =
        typeof location?.x === "number" && typeof location?.y === "number";

      return {
        ...user,
        lastSeen: location?.updated_at || null,
        location: hasCoordinates ? [location.x!, location.y!] : null,
        floor: typeof location?.floor === "number" ? location.floor : null,
        status: friendlyLocation || "ei sijaintia",
        user_friendly_location: friendlyLocation,
      };
    })
  );

  return combined;
};

// Save to AsyncStorage
const cacheFriends = async (friends: Friend[]) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(friends));
  } catch (err) {
    console.warn("Failed to cache friends", err);
  }
};

// Get from AsyncStorage
const getCachedFriends = async (): Promise<Friend[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to load cached friends", err);
    return null;
  }
};

// Public method
export const getFriends = async (forceRefresh = false): Promise<Friend[]> => {
  if (!forceRefresh) {
    const cached = await getCachedFriends();
    if (cached) return cached;
  }

  console.log("Fetching fresh friends");
  const fresh = await fetchFriendsFromSupabase();
  console.log("Friends fetched", fresh);
  await cacheFriends(fresh);
  return fresh;
};

export const getRequests = async () => {
  const user = await getUser();
  console.log(
    `👤 Authenticated user: ${
      user?.id || "None"
    } in friendsHandler.ts in getRequests`
  );
  if (!user?.id) {
    console.log("Error fetching user");
    return [];
  }

  const { data: requests, error: requestsError } = await supabase
    .from("relations")
    .select("*")
    .eq("status", "request")
    .eq("object", user.id);

  if (requestsError) {
    console.log("Error fetching requests:", requestsError);
    return [];
  }

  console.log("Requests fetched", requests);
  return requests;
};

// export const handleStopSharing = async (friendId: string) => {
//   const user = await getUser();
//   const { data: location, error: locationError } = await supabase
//     .from("locations")
//     .select("shared_to")
//     .eq("user_id", user.id)
//     .single();

//   if (locationError) {
//     console.log("Error fetching locations:", locationError);
//     return;
//   }

//   const sharedTo = location?.shared_to || [];
//   const updatedSharedTo = sharedTo.filter((id: any) => id !== friendId);

//   const { error: stopSharingError } = await supabase
//     .from("locations")
//     .update({ shared_to: updatedSharedTo })
//     .eq("user_id", user.id);

//   if (stopSharingError) {
//     console.log("Error updating shared_to:", stopSharingError);
//   }
// };

export const handleBlockFriend = async (friendId: string) => {
  const user = await getUser();
  if (!user) {
    throw new Error("Käyttäjä ei ole kirjautunut sisään.");
  }

  const { error: removeError } = await supabase
    .from("relations")
    .delete()
    .or(
      `and(subject.eq.${friendId},object.eq.${user.id}),and(subject.eq.${user.id},object.eq.${friendId})`
    );

  if (removeError) {
    throw removeError;
  }

  const { error: blockError } = await supabase.from("relations").insert({
    subject: user.id,
    object: friendId,
    status: "blocked",
  });

  if (blockError) {
    throw blockError;
  }
};

export const handleRemoveFriend = async (friendId: string) => {
  const user = await getUser();
  if (!user) {
    throw new Error("Käyttäjä ei ole kirjautunut sisään.");
  }

  const { error: removeError } = await supabase
    .from("relations")
    .delete()
    .eq("status", "friends")
    .or(
      `and(subject.eq.${friendId},object.eq.${user.id}),and(subject.eq.${user.id},object.eq.${friendId})`
    );

  if (removeError) {
    throw removeError;
  }
};
