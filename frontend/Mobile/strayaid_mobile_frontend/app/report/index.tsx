import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MapPreview from "../../components/report/MapPreview";
import { describeLocation, findAddress, getCurrentLocation, hasLocationPermission } from "../../services/locationService";
import {
  resetReportDraft,
  setReportLocation,
  setReportLocationFromSearch,
  updateReportDraft,
  useReportDraft,
} from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";

// Stitch screen 7: Report an animal, step 1 (photo + location).

export default function ReportPhotoLocationScreen() {
  const draft = useReportDraft();
  const [addressText, setAddressText] = useState(draft.address);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchingRef = useRef(false);

  // Keep the field in sync when the location changes elsewhere (GPS, map picker).
  useEffect(() => setAddressText(draft.address), [draft.address]);

  const locateMe = async () => {
    setLocating(true);
    setError(null);
    try {
      await setReportLocation(await getCurrentLocation(), describeLocation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  // Start from where the reporter is standing if location access was already given.
  useEffect(() => {
    if (draft.location) return;
    hasLocationPermission().then((granted) => {
      if (granted) locateMe();
    });
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchAddress = async () => {
    const query = addressText.trim();
    if (!query || query === draft.address || searchingRef.current) return;
    searchingRef.current = true;
    setSearching(true);
    setError(null);
    try {
      setReportLocationFromSearch(await findAddress(query), query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't find that place.");
    } finally {
      searchingRef.current = false;
      setSearching(false);
    }
  };

  const takePhoto = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        source === "camera" ? "Camera access needed" : "Photo access needed",
        "Allow access in your phone's settings to add a photo of the animal."
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    updateReportDraft({
      photo: { uri: asset.uri, name: asset.fileName || "report.jpg", type: asset.mimeType || "image/jpeg" },
    });
    setError(null);
  };

  const choosePhoto = () => {
    if (Platform.OS === "web") {
      takePhoto("library");
      return;
    }
    Alert.alert(draft.photo ? "Change photo" : "Add a photo", "A clear, close photo helps rescuers find the animal.", [
      { text: "Take photo", onPress: () => takePhoto("camera") },
      { text: "Choose from gallery", onPress: () => takePhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const leave = () => {
    resetReportDraft();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const goBack = () => {
    if (!draft.photo && !draft.location) {
      leave();
      return;
    }
    Alert.alert("Discard this report?", "The photo and location you added will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: leave },
    ]);
  };

  const next = () => {
    if (!draft.photo) {
      setError("Add a photo of the animal first.");
      return;
    }
    if (!draft.location) {
      setError("Add the animal's location: use your current location, search, or pin it on the map.");
      return;
    }
    setError(null);
    router.push("/report/details" as Href);
  };

  const busy = locating || searching;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={30} color="#1F2937" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Report an animal in need
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoCard}>
            <Pressable
              onPress={choosePhoto}
              accessibilityRole="button"
              accessibilityLabel={draft.photo ? "Change photo" : "Add a photo"}
              style={styles.photoArea}
            >
              {draft.photo ? (
                <Image source={{ uri: draft.photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={styles.photoEmpty}>
                  <MaterialIcons name="pets" size={40} color="#D1D5DB" />
                  <Text style={styles.photoHint}>A clear, close photo helps rescuers</Text>
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)"]}
                style={styles.photoShade}
                pointerEvents="none"
              />
              <View style={styles.photoPill}>
                <Ionicons name="camera-outline" size={16} color="#374151" />
                <Text style={styles.photoPillText}>{draft.photo ? "Change photo" : "Add a photo"}</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.locationGroup}>
            <Pressable
              onPress={() => router.push("/map/select-location" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Pin the location on a map"
              style={styles.mapCard}
            >
              <MapPreview location={draft.location} loading={locating} emptyText="Tap to pin the location on the map" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={locateMe}
              disabled={locating}
              hitSlop={6}
              style={({ pressed }) => [styles.currentLocation, pressed && styles.pressed]}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons name="my-location" size={16} color={colors.primary} />
              )}
              <Text style={styles.currentLocationText}>Use my current location</Text>
            </Pressable>

            <View style={styles.addressBox}>
              <Ionicons name="location-outline" size={17} color="#9CA3AF" />
              <TextInput
                style={styles.addressInput}
                value={addressText}
                onChangeText={(value) => {
                  setAddressText(value);
                  if (error) setError(null);
                }}
                onSubmitEditing={searchAddress}
                onBlur={searchAddress}
                placeholder={draft.location && !draft.address ? "Finding the address…" : "Search an address or landmark"}
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Animal's location"
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          </View>

          {error && (
            <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            disabled={busy}
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextPressed, busy && styles.disabled]}
          >
            <Text style={styles.nextText}>Next</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  back: { width: 36, height: 36, marginLeft: -4, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F3F4F6" },
  title: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: -0.4, color: "#111827" },
  navSpacer: { width: 36, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 16 },
  photoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  photoArea: {
    height: 216,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  photoEmpty: { alignItems: "center", gap: 8, paddingBottom: 40 },
  photoHint: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#9CA3AF" },
  photoShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64 },
  photoPill: {
    position: "absolute",
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  photoPillText: { fontFamily: fonts.displaySemiBold, fontSize: 13, lineHeight: 16, color: "#1F2937" },
  locationGroup: { paddingTop: 4, gap: 12 },
  mapCard: {
    height: 184,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentLocation: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 4, paddingTop: 2 },
  pressed: { opacity: 0.75 },
  currentLocationText: {
    fontFamily: fonts.displayBold,
    fontSize: 13.5,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: colors.primary,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  addressInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    letterSpacing: -0.2,
    color: "#374151",
  },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.criticalSoft,
  },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#B4483A" },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.surface },
  nextButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  nextPressed: { backgroundColor: "#165343", transform: [{ scale: 0.985 }] },
  nextText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onPrimary },
  disabled: { opacity: 0.7 },
});
