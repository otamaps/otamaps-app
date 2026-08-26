import { setAccessToken } from "@rnmapbox/maps";

// Mapbox GL Native needs its *public* access token (starts with `pk.`) set
// once at startup before any map renders — without this every style request
// (e.g. mapbox://styles/mapbox/streets-v12) 401s with "Not Authorized -
// Invalid Token". This must never be a secret token (`sk.`): those are for
// build-time SDK downloads only and are rejected for runtime style requests
// anyway, so using one here can't work even by accident.
const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

if (token) {
  void setAccessToken(token);
} else {
  console.warn(
    "[mapbox] EXPO_PUBLIC_MAPBOX_TOKEN is not set — the map will fail to load. " +
      "Set it to a Mapbox public token (starts with pk.) from https://account.mapbox.com/access-tokens/."
  );
}
