-- Create user_locations table for tracking user positions via BLE beacons
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID NULL, -- References rooms table (nullable when user is not in any room)
  beacon_id TEXT NULL, -- The BLE beacon identifier
  rssi INTEGER NULL, -- Signal strength in dBm
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coordinates POINT NULL, -- Geographic coordinates as PostGIS point
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_timestamp ON user_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_locations_room_id ON user_locations(room_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_beacon_id ON user_locations(beacon_id);

-- Create a composite index for queries filtering by user and time
CREATE INDEX IF NOT EXISTS idx_user_locations_user_timestamp ON user_locations(user_id, timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own location data
CREATE POLICY "Users can view their own location data" ON user_locations
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own location data
CREATE POLICY "Users can insert their own location data" ON user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own location data
CREATE POLICY "Users can update their own location data" ON user_locations
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own location data
CREATE POLICY "Users can delete their own location data" ON user_locations
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically clean up old location data (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_user_locations()
RETURNS void AS $$
BEGIN
  DELETE FROM user_locations 
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup weekly (if pg_cron extension is available)
-- This will need to be enabled manually in Supabase if desired
-- SELECT cron.schedule('cleanup_user_locations', '0 2 * * 0', 'SELECT cleanup_old_user_locations();');

-- Optional: Create a view for getting the latest location per user
CREATE OR REPLACE VIEW latest_user_locations AS
SELECT DISTINCT ON (user_id) 
  user_id,
  room_id,
  beacon_id,
  rssi,
  timestamp,
  coordinates
FROM user_locations
ORDER BY user_id, timestamp DESC;

-- Grant permissions on the view
ALTER VIEW latest_user_locations OWNER TO postgres;
GRANT SELECT ON latest_user_locations TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can view their own latest location" ON latest_user_locations
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE user_locations IS 'Stores user location data derived from BLE beacon scanning';
COMMENT ON COLUMN user_locations.user_id IS 'Reference to the user in auth.users';
COMMENT ON COLUMN user_locations.room_id IS 'Reference to the room (nullable when user is not in any room)';
COMMENT ON COLUMN user_locations.beacon_id IS 'BLE beacon identifier that was detected';
COMMENT ON COLUMN user_locations.rssi IS 'Received Signal Strength Indicator in dBm';
COMMENT ON COLUMN user_locations.coordinates IS 'Geographic coordinates as PostGIS point';
COMMENT ON VIEW latest_user_locations IS 'View showing the most recent location for each user';
