import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reportStyles as styles } from "../../../styles/ReportStyles";
import { submitReport } from "../../../services/mobileContentService";

type LatLng = { latitude: number; longitude: number };

export default function ReportPage() {
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");

  useFocusEffect(
    useCallback(() => {
      const loadSelectedLocation = async () => {
        const selectedLocationStr = await AsyncStorage.getItem("selectedLocation");
        if (!selectedLocationStr) return;
        const selectedLocation = JSON.parse(selectedLocationStr) as LatLng;
        setLocation(selectedLocation);
        setLocationText(`${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)}`);
        await AsyncStorage.removeItem("selectedLocation");
      };

      loadSelectedLocation().catch(console.error);
    }, [])
  );

  const resolveLocationFromText = async () => {
    if (!locationText.trim()) {
      Alert.alert("Enter location", "Type an address or landmark first.");
      return;
    }

    try {
      const results = await Location.geocodeAsync(locationText);
      if (!results.length) {
        Alert.alert("Not found", "Could not find location for that address.");
        return;
      }

      const coords = { latitude: results[0].latitude, longitude: results[0].longitude };
      setLocation(coords);
      setLocationText(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
    } catch (error) {
      console.error(error);
      Alert.alert("Geocode error", "Location lookup failed.");
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Photo library access is needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets.length) {
      setImage(result.assets[0]);
    }
  };

  const captureImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is needed.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets.length) {
      setImage(result.assets[0]);
    }
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Location permission is required.");
      return;
    }

    const current = await Location.getCurrentPositionAsync({});
    const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
    setLocation(coords);
    setLocationText(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
  };

  const handleSubmit = async () => {
    if (!image) {
      Alert.alert("Missing image", "Please add a photo first.");
      return;
    }

    let finalLocation = location;
    if (!finalLocation && locationText.trim()) {
      try {
        const results = await Location.geocodeAsync(locationText);
        if (results.length) {
          finalLocation = { latitude: results[0].latitude, longitude: results[0].longitude };
          setLocation(finalLocation);
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!finalLocation) {
      Alert.alert("Missing location", "Select a location before submitting.");
      return;
    }

    const formData = new FormData();
    formData.append("description", description);
    formData.append("latitude", finalLocation.latitude.toString());
    formData.append("longitude", finalLocation.longitude.toString());
    formData.append("image", {
      uri: image.uri,
      name: image.fileName || "report.jpg",
      type: image.mimeType || "image/jpeg",
    } as never);

    try {
      await submitReport(formData);
      Alert.alert("Success", "Your report has been submitted.");
      setImage(null);
      setLocation(null);
      setLocationText("");
      setDescription("");
      router.replace("/(tabs)/feed");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Report submission failed.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Report</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Photo</Text>
          <View style={styles.row}>
            <Pressable style={[styles.actionButton, styles.rowButton]} onPress={pickImage}>
              <Text style={styles.actionButtonText}>Choose Photo</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.rowButton]} onPress={captureImage}>
              <Text style={styles.actionButtonText}>Take Photo</Text>
            </Pressable>
          </View>
          {image ? <Image source={{ uri: image.uri }} style={styles.imagePreview} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              placeholder="Enter address, landmark, or map pin"
              value={locationText}
              onChangeText={setLocationText}
              placeholderTextColor="#6d8594"
            />
            <Pressable style={styles.mapButton} onPress={() => router.push("/map/select-location")}>
              <Ionicons name="map-outline" size={24} color="#12344a" />
            </Pressable>
          </View>
          <View style={styles.row}>
            <Pressable style={[styles.actionButton, styles.rowButton]} onPress={resolveLocationFromText}>
              <Text style={styles.actionButtonText}>Search Address</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.rowButton]} onPress={getCurrentLocation}>
              <Text style={styles.actionButtonText}>Use My Location</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>Use the map icon to pin the exact spot if the address is approximate.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the animal's condition, injuries, or what help is needed."
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor="#6d8594"
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Submit Report</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
