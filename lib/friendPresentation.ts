const UNKNOWN_LOCATION_VALUES = new Set([
  "",
  "unknown",
  "unknown location",
  "ei sijaintia",
  "null",
  "undefined",
]);

export function knownFriendLocation(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return UNKNOWN_LOCATION_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

export function friendLocationSentence(value?: string | null): string {
  const location = knownFriendLocation(value);
  return location ? `Luokassa ${location}` : "Ei sijaintia vielä";
}

export function friendLocationListLabel(value?: string | null): string {
  return knownFriendLocation(value) ?? "Ei sijaintia vielä";
}
