# BLE Location Tracking

This directory contains the enhanced BLE (Bluetooth Low Energy) location tracking functionality for the OtaMaps app.

## OtaMaps Beacon Format

The system is specifically designed to work with OtaMaps ESP32 beacons that follow this format:

### ESP32 Beacon Configuration
- **Service UUID**: `f47fcfd9-0634-49de-8e99-80d05ae8fcef`
- **Device Name**: "Room"
- **Service Data**: Contains the room identifier (e.g., "001", "A123")
- **Manufacturer Data**: Also contains the room identifier as backup
- **Advertising Type**: Non-connectable (ADV_TYPE_NONCONN_IND)

### Beacon Detection Logic
The BLE scanner specifically filters for beacons that:
1. Have the correct service UUID (`f47fcfd9-0634-49de-8e99-80d05ae8fcef`)
2. Have device name "Room"
3. Contain room ID in service data or manufacturer data
4. Have RSSI signal strength above -80 dBm threshold
5. Room ID is not "none" (ESP32 default when not configured)

## Features

### Core Functionality

- **Continuous Background Scanning**: Automatically scans for BLE beacons even when the app is backgrounded
- **Room Detection**: Determines which room the user is in based on beacon proximity and signal strength
- **Automatic Data Upload**: Periodically uploads location data to Supabase (every 30 seconds)
- **Signal Strength Analysis**: Uses RSSI values to determine the closest beacon
- **Beacon Timeout**: Automatically removes stale beacon data (10 second timeout)

### API Methods

#### useBLEScanner Hook

```typescript
const {
  currentRoom,           // Current room ID or null
  getCurrentRoom,        // Function to get current room
  isInAnyRoom,          // Boolean indicating if user is in any room
  getScannedBeacons,    // Get list of currently scanned beacons
  forceUploadLocation   // Manually trigger location upload
} = useBLEScanner();
```

#### BLELocationService

```typescript
// Upload location data
await BLELocationService.uploadLocation(locationData);

// Get current location
const currentLocation = await BLELocationService.getCurrentLocation();

// Get location history (last 24 hours)
const history = await BLELocationService.getLocationHistory(24);

// Get users in a specific room
const usersInRoom = await BLELocationService.getUsersInRoom(roomId);

// Clean up old location data
await BLELocationService.cleanupOldLocations(7);

// Subscribe to real-time updates
const subscription = BLELocationService.subscribeToLocationUpdates(userId, callback);
```

## Database Schema

The system uses a `user_locations` table in Supabase with the following structure:

```sql
user_locations (
  id: UUID PRIMARY KEY,
  user_id: UUID REFERENCES auth.users(id),
  room_id: UUID NULL,           -- Room ID from rooms table
  beacon_id: TEXT NULL,         -- BLE beacon identifier
  rssi: INTEGER NULL,           -- Signal strength in dBm
  timestamp: TIMESTAMPTZ,       -- When the location was recorded
  coordinates: POINT NULL,      -- Geographic coordinates
  created_at: TIMESTAMPTZ
)
```

### Views

- `latest_user_locations` - Shows the most recent location for each user

### Policies

- Row Level Security (RLS) enabled
- Users can only access their own location data
- Full CRUD permissions for own data

## Beacon Configuration

OtaMaps beacons are configured in `lib/idTranslation.ts`:

```typescript
const beaconRegistry: Record<BeaconID, BeaconLocation> = {
  // ESP32 beacon with room ID "001"
  '001': {
    roomId: 'be0080cf-8bf3-4d01-91a0-d07beadd7295',
    coordinates: [60.18394, 24.81851],
    radius: 10
  },
  // ESP32 beacon with room ID "A123"  
  'A123': {
    roomId: '12345678-1234-5678-9abc-123456789012',
    coordinates: [60.18400, 24.81860],
    radius: 15
  }
  // Add more beacons here...
};
```

### Adding New OtaMaps Beacons

1. **Configure ESP32**: Set the `ROOM_ID` in your ESP32 firmware (e.g., "002", "B456")
2. **Add to Registry**: Add beacon entry to `beaconRegistry` in `idTranslation.ts`
3. **Ensure Room Exists**: Make sure the `roomId` matches an existing room UUID in your Supabase database
4. **Set Coordinates**: Add the physical location coordinates of the beacon
5. **Deploy**: The mobile app will automatically detect the new beacon

### ESP32 Firmware Setup

Your ESP32 should store the room ID in non-volatile storage:

```cpp
// In your ESP32 setup()
prefs.begin("room", false);
prefs.putString("room_id", "001"); // Your room identifier
prefs.end();
```

## Configuration

### RSSI Threshold

- Default: -80 dBm
- Beacons with weaker signals are ignored
- Adjust in `BLEScannerService.RSSI_THRESHOLD`

### Upload Interval

- Default: 30 seconds
- Adjust in `BLEScannerService.UPLOAD_INTERVAL`

### Beacon Timeout

- Default: 10 seconds
- Beacons not seen for this duration are removed
- Adjust in `BLEScannerService.BEACON_TIMEOUT`

## Permissions

The system automatically requests the following permissions:

### Android

- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`

### iOS

- Location permissions are handled by React Native Expo

## Usage Example

```typescript
import useBLEScanner from '@/components/functions/bleScanner';
import { BLELocationService } from '@/lib/bleLocationService';

function MyComponent() {
  const { currentRoom, isInAnyRoom, forceUploadLocation } = useBLEScanner();

  useEffect(() => {
    if (currentRoom) {
      console.log(`User entered room: ${currentRoom}`);
    }
  }, [currentRoom]);

  return (
    <View>
      <Text>Current Room: {currentRoom || 'Not in any room'}</Text>
      <Text>Status: {isInAnyRoom() ? 'Inside' : 'Outside'}</Text>
      <Button 
        title="Upload Location Now" 
        onPress={forceUploadLocation}
      />
    </View>
  );
}
```

## Troubleshooting

### Common Issues

1. **No beacons detected**
   - Check if Bluetooth is enabled
   - Verify beacon is broadcasting
   - Check if beacon ID format matches expected format in `extractBeaconId`

2. **Permissions denied**
   - Ensure all required permissions are granted
   - Check Android API level compatibility for background location

3. **Location not uploading**
   - Verify user is authenticated with Supabase
   - Check network connectivity
   - Review Supabase logs for insertion errors

### Debugging

Enable debug logging by uncommenting console.log statements in:

- `processBeacon` method for beacon detection
- `updateCurrentRoom` method for room changes
- `uploadLocationToSupabase` method for upload status

## Performance Considerations

- Background scanning may impact battery life
- Upload frequency can be adjusted based on requirements
- Old location data is automatically cleaned up (30 days by default)
- Consider implementing exponential backoff for failed uploads

## Security

- All location data is protected by Row Level Security
- Users can only access their own location history
- Beacon IDs should not contain sensitive information
- Consider encrypting sensitive location data if required

## Future Enhancements

- [ ] Implement exponential backoff for failed uploads
- [ ] Add offline queue for location data when network is unavailable
- [ ] Support for multiple beacon types/protocols
- [ ] Machine learning for improved room detection accuracy
- [ ] Geofencing integration for outdoor location tracking
