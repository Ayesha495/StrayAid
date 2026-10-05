import * as Location from "expo-location";

import type { LatLng } from "./reportDraft";

// GPS, address lookup and address search for the report flow.
// The phone's own geocoder is tried first; OpenStreetMap Nominatim (free, no key) is the
// fallback, e.g. on the web build or when the device geocoder has no result.

const NOMINATIM = "https://nominatim.openstreetmap.org";

export class LocationError extends Error {}

export async function getCurrentLocation(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new LocationError("Allow location access, or pin the spot on the map instead.");
  }
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    throw new LocationError("We couldn't get your location. Check that location is turned on.");
  }
}

// True when the app may already use location, without showing a permission prompt.
export async function hasLocationPermission() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

const join = (...parts: (string | null | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter((part, index, all): part is string => !!part && all.indexOf(part) === index)
    .join(", ");

export function formatCoordinates({ latitude, longitude }: LatLng) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

// A short place name such as "F-7 Markaz, Islamabad".
export async function describeLocation(location: LatLng): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync(location);
    const label = place && join(place.district || place.street || place.name, place.city || place.subregion || place.region);
    if (label) return label;
  } catch {
    // Fall through to Nominatim.
  }

  try {
    const response = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&zoom=16&lat=${location.latitude}&lon=${location.longitude}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await response.json();
    const a = data?.address ?? {};
    const label = join(
      a.suburb || a.neighbourhood || a.quarter || a.road || a.village,
      a.city || a.town || a.county || a.state
    );
    if (label) return label;
  } catch {
    // Offline or rate limited: show coordinates instead.
  }
  return formatCoordinates(location);
}

// Typed address or landmark -> coordinates.
export async function findAddress(query: string): Promise<LatLng> {
  const text = query.trim();
  try {
    const [result] = await Location.geocodeAsync(text);
    if (result) return { latitude: result.latitude, longitude: result.longitude };
  } catch {
    // Fall through to Nominatim.
  }

  try {
    const response = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`, {
      headers: { Accept: "application/json" },
    });
    const [result] = await response.json();
    if (result) return { latitude: Number(result.lat), longitude: Number(result.lon) };
  } catch {
    throw new LocationError("We couldn't search for that address. Check your connection.");
  }
  throw new LocationError("We couldn't find that place. Try a nearby landmark or pin it on the map.");
}
