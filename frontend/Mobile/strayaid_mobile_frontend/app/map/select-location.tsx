import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LocationMapPicker from "../../components/LocationMapPicker";
import { describeLocation, getCurrentLocation } from "../../services/locationService";
import { getReportDraft, LatLng, setReportLocation } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";

// Full-screen map for pinning the exact spot, opened from the map on Stitch screen 7.
// Not a Stitch screen of its own; it follows the report flow's look.

// Islamabad, used when there's no pin yet and no GPS fix.
const FALLBACK: LatLng = { latitude: 33.6938, longitude: 73.0652 };

export default function SelectLocationScreen() {
  const [start, setStart] = useState<LatLng | null>(getReportDraft().location);
  const [marker, setMarker] = useState<LatLng | null>(getReportDraft().location);

  useEffect(() => {
    if (start) return;
    getCurrentLocation()
      .catch(() => FALLBACK)
      .then((location) => {
        setStart(location);
        setMarker(location);
      });
  }, [start]);

  const confirm = () => {
    if (!marker) return;
    setReportLocation(marker, describeLocation);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={30} color="#1F2937" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Pin the location
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.map}>
        {start ? (
          <LocationMapPicker
            location={start}
            markerPosition={marker}
            onPress={(event) => setMarker(event.nativeEvent.coordinate)}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.helper}>Tap the map or drag the pin to where the animal is.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={confirm}
          disabled={!marker}
          style={({ pressed }) => [styles.confirm, pressed && styles.confirmPressed, !marker && styles.disabled]}
        >
          <Text style={styles.confirmText}>Confirm location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: { width: 36, height: 36, marginLeft: -4, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F3F4F6" },
  title: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: -0.4, color: "#111827" },
  navSpacer: { width: 36, height: 36 },
  map: { flex: 1, backgroundColor: "#F2EFE9" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  panel: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, gap: 12 },
  helper: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkMuted, textAlign: "center" },
  confirm: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPressed: { backgroundColor: "#165343" },
  confirmText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onPrimary },
  disabled: { opacity: 0.6 },
});
