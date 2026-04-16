import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "../../../utils/tokenStorage";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LatLng = {
  latitude: number;
  longitude: number;
};

const palette = {
  white: "#ffffff",
  cream: "#f7faf9",
  teal: "#0f766e",
  amber: "#d97706",
  ink: "#172033",
  muted: "#6e6458",
  border: "#e8dccd",
};

export default function ReportScreen() {
  const API_BASE = process.env.IP || "http://192.168.1.8:8000";

  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadSelectedLocation = async () => {
        try {
          const selectedLocationStr = await AsyncStorage.getItem(
            "selectedLocation"
          );
          if (selectedLocationStr) {
            const selectedLocation = JSON.parse(selectedLocationStr);
            setLocation(selectedLocation);
            setLocationText(
              `${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`
            );
            await AsyncStorage.removeItem("selectedLocation");
          }
        } catch (error) {
          console.error("Error loading selected location:", error);
        }
      };

      loadSelectedLocation();
    }, [])
  );

  const resolveLocationFromText = async () => {
    if (!locationText.trim()) {
      Alert.alert("Enter location", "Type an address or landmark first.");
      return null;
    }

    try {
      const results = await Location.geocodeAsync(locationText);
      if (!results || results.length === 0) {
        Alert.alert("Not found", "Could not find location for input text.");
        return null;
      }

      const first = results[0];
      const coords = { latitude: first.latitude, longitude: first.longitude };
      setLocation(coords);
      setLocationText(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      return coords;
    } catch (error) {
      Alert.alert("Geocode error", "Location lookup failed.");
      console.error(error);
      return null;
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Camera permission is needed.");
      return;
    }

    Alert.alert("Select Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            setImage(result.assets[0]);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission denied", "Location permission is required.");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  const openMap = () => {
    router.push("/map/select-location");
  };

  const submitReport = async () => {
    if (!image) {
      Alert.alert("Missing Image", "Please add a photo.");
      return;
    }

    let reportLocation = location;
    if (!reportLocation && locationText.trim()) {
      reportLocation = await resolveLocationFromText();
    }

    if (!reportLocation) {
      Alert.alert("Missing Location", "Please select location.");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await getToken();

      if (!token) {
        router.replace("/login/index");
        return;
      }

      const formData = new FormData();

      formData.append("description", description);
      formData.append("latitude", reportLocation.latitude.toString());
      formData.append("longitude", reportLocation.longitude.toString());

      formData.append("image", {
        uri: image.uri,
        name: "photo.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(`${API_BASE}/api/cases/report/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Report submitted successfully.");
        setImage(null);
        setLocation(null);
        setLocationText("");
        setDescription("");
      } else if (response.status === 401) {
        Alert.alert("Session expired", "Please login again.");
        router.replace("/login/index");
      } else {
        Alert.alert("Error", JSON.stringify(data));
      }
    } catch (error) {
      Alert.alert("Network Error", (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Create Report</Text>
          <Text style={styles.title}>Capture what you see and send it with a clear location.</Text>
          <Text style={styles.subtitle}>
            Reports go to the rescue system linked to your account so you can track the outcome later.
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable style={styles.mediaPicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.image} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={palette.teal} />
                <Text style={styles.mediaTitle}>Add a photo</Text>
                <Text style={styles.mediaHint}>Take a photo or choose one from your gallery.</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.locationPanel}>
            <Text style={styles.sectionLabel}>Location</Text>
            <View style={styles.locationRow}>
              <TextInput
                style={styles.locationInput}
                placeholder="Enter landmark or address"
                placeholderTextColor={palette.muted}
                value={locationText}
                onChangeText={setLocationText}
              />
              <Pressable style={styles.iconButton} onPress={openMap}>
                <Ionicons name="map-outline" size={22} color={palette.ink} />
              </Pressable>
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryAction} onPress={resolveLocationFromText}>
                <Text style={styles.secondaryActionText}>Search Address</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={getLocation}>
                <Text style={styles.secondaryActionText}>Use Current</Text>
              </Pressable>
            </View>
            {location ? (
              <Text style={styles.locationValue}>
                Selected: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={styles.description}
              placeholder="Describe the animal, injuries, behavior, and nearby landmarks."
              placeholderTextColor={palette.muted}
              multiline
              numberOfLines={6}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Pressable style={styles.primaryButton} onPress={submitReport} disabled={isSubmitting}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? "Submitting..." : "Submit Report"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.white,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 18,
  },
  hero: {
    gap: 10,
  },
  eyebrow: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.cream,
    borderRadius: 28,
    padding: 18,
    gap: 18,
  },
  mediaPicker: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    minHeight: 220,
    borderWidth: 1,
    borderColor: palette.border,
  },
  mediaPlaceholder: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  mediaTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  mediaHint: {
    color: palette.muted,
    fontSize: 14,
    textAlign: "center",
  },
  image: {
    height: 220,
    width: "100%",
  },
  locationPanel: {
    gap: 12,
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.ink,
  },
  iconButton: {
    backgroundColor: "#fff4df",
    borderRadius: 16,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
  },
  secondaryActionText: {
    color: palette.ink,
    fontWeight: "700",
  },
  locationValue: {
    color: palette.teal,
    fontWeight: "600",
  },
  description: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    padding: 14,
    height: 140,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: palette.teal,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
