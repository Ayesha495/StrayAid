import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";

import type { LatLng } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";

// Small static map with the brand pin in the middle (Stitch 7). Built from a few
// OpenStreetMap tiles (free, no API key, no WebView). A light wash softens OSM's colours
// towards the Stitch map. OSM's tile policy asks apps to identify themselves, hence the header.

const TILE = 256;
const ZOOM = 15;
const TILE_URL = (x: number, y: number) => `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;
const TILE_HEADERS = { "User-Agent": "StrayAid/1.0 (student rescue app)" };

type Props = {
  location: LatLng | null;
  loading?: boolean;
  emptyText?: string;
};

function tilesFor(location: LatLng, width: number, height: number) {
  const scale = 2 ** ZOOM;
  const latRad = (location.latitude * Math.PI) / 180;
  const centerX = ((location.longitude + 180) / 360) * scale * TILE;
  const centerY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale * TILE;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  const tiles: { key: string; uri: string; x: number; y: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      tiles.push({ key: `${tx}-${ty}`, uri: TILE_URL(tx, ty), x: tx * TILE - left, y: ty * TILE - top });
    }
  }
  return tiles;
}

function Pin() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.pinLayer} pointerEvents="none">
      <Animated.View
        style={[
          styles.ping,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }) },
          { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }] },
        ]}
      />
      <View style={styles.halo} />
      <View style={styles.pin}>
        <MaterialCommunityIcons name="map-marker" size={36} color={colors.primary} />
        <View style={styles.pinDot} />
      </View>
    </View>
  );
}

export default function MapPreview({ location, loading, emptyText }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const tiles = location && size.width ? tilesFor(location, size.width, size.height) : [];

  return (
    <View style={styles.map} onLayout={onLayout}>
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri, headers: TILE_HEADERS }}
          style={[styles.tile, { left: tile.x, top: tile.y }]}
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ))}

      {location ? (
        <>
          <View style={styles.wash} pointerEvents="none" />
          <Pin />
          <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
        </>
      ) : (
        <View style={styles.empty}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="map-marker-question-outline" size={28} color="#9CA3AF" />
          )}
          <Text style={styles.emptyText}>{loading ? "Finding your location…" : emptyText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#F2EFE9", overflow: "hidden" },
  tile: { position: "absolute", width: TILE, height: TILE },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(250,248,243,0.35)" },
  pinLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ping: { position: "absolute", width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(30,107,86,0.2)" },
  halo: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(30,107,86,0.25)" },
  // Lift the pin so its tip, not its middle, sits on the spot.
  pin: {
    transform: [{ translateY: -14 }],
    // iOS shadows follow the pin's shape; elsewhere they'd draw a box around it.
    ...Platform.select({
      ios: { shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 },
      default: {},
    }),
  },
  pinDot: {
    position: "absolute",
    top: 9,
    left: 13,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  attribution: {
    position: "absolute",
    right: 0,
    bottom: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderTopLeftRadius: 6,
    backgroundColor: "rgba(255,255,255,0.75)",
    fontFamily: fonts.body,
    fontSize: 9,
    color: "rgba(36,52,71,0.6)",
  },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  emptyText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textAlign: "center" },
});
