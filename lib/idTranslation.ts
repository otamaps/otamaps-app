import { supabase } from "@/lib/supabase";

interface BeaconLocation {
  roomId: string;
  coordinates: [number, number];
  radius: number;
}

type BeaconID = string;
type Coordinates = [number, number];

// Fetch beacons from Supabase
const fetchBeacons = async () => {
  const { data, error } = await supabase.from("beacons").select("*");
  if (error) throw error;
  return data;
};

/**
 * Gets the room ID associated with a beacon ID
 * @param beaconId - The ID of the beacon
 * @returns The room ID if found, otherwise undefined
 */
const getRoomIdFromBleId = async (
  bleId: string
): Promise<string | undefined> => {
  var intBleId: number = +bleId;

  const { data, error } = await supabase
    .from("beacons")
    .select("room_id")
    .eq("ble_id", intBleId)
    .maybeSingle();

  if (error) {
    console.error(
      "Error fetching room_id from ble_id:",
      error.message,
      intBleId
    );
    return undefined;
  }

  if (data) {
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", data.room_id)
      .maybeSingle();

    if (roomError) {
      console.error("Error fetching room_id from room_id:", roomError.message);
      return undefined;
    }

    return roomData?.room_number;
  }

  return undefined;
};

/**
 * Gets the location coordinates associated with a beacon ID
 * @param beaconId - The ID of the beacon
 * @returns The coordinates as [latitude, longitude] if found, otherwise undefined
 */
const getLocationFromBeaconID = async (
  beaconId: BeaconID
): Promise<Coordinates | undefined> => {
  const beacons = await fetchBeacons();
  const beacon = beacons.find((b) => b.id === beaconId);
  return [beacon?.x, beacon?.y];
};

export { getLocationFromBeaconID, getRoomIdFromBleId };
export type { BeaconID, Coordinates };
