interface BeaconLocation {
  roomId: string;
  coordinates: [number, number];
  radius: number;
}

type BeaconID = string;
type RoomID = string;
type Coordinates = [number, number];

/**
 * Map of beacon IDs to their location information
 */
const beaconRegistry: Record<BeaconID, BeaconLocation> = {
  '001': {
    roomId: 'be0080cf-8bf3-4d01-91a0-d07beadd7295',
    coordinates: [60.18394, 24.81851],
    radius: 10
  }
};

/**
 * Gets the room ID associated with a beacon ID
 * @param beaconId - The ID of the beacon
 * @returns The room ID if found, otherwise undefined
 */
const getRoomFromBeaconID = (beaconId: BeaconID): RoomID | undefined => {
  return beaconRegistry[beaconId]?.roomId;
};

/**
 * Gets the location coordinates associated with a beacon ID
 * @param beaconId - The ID of the beacon
 * @returns The coordinates as [latitude, longitude] if found, otherwise undefined
 */
const getLocationFromBeaconID = (beaconId: BeaconID): Coordinates | undefined => {
  return beaconRegistry[beaconId]?.coordinates;
};

export { getLocationFromBeaconID, getRoomFromBeaconID };
export type { BeaconID, Coordinates, RoomID };

