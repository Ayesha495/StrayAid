import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  Image,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Text
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "../../../utils/tokenStorage";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";

type LatLng = {
  latitude: number;
  longitude: number;
};

export default function ReportScreen() {
  const API_BASE = process.env.IP || "http://192.168.1.8:8000";

  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");

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
      return;
    }

    try {
      const results = await Location.geocodeAsync(locationText);
      if (!results || results.length === 0) {
        Alert.alert("Not found", "Could not find location for input text.");
        return;
      }

      const first = results[0];
      const coords = { latitude: first.latitude, longitude: first.longitude };
      setLocation(coords);
      setLocationText(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      Alert.alert("Location selected", "Address resolved to map coordinates.");
    } catch (error) {
      Alert.alert("Geocode error", "Location lookup failed.");
      console.error(error);
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

    if (!location) {
        if (locationText.trim()) {
          await resolveLocationFromText();
        }
      }

      if (!location) {
        Alert.alert("Missing Location", "Please select location.");
        return;
      }
    try {
      const token = await getToken();

      if (!token) {
        router.replace("/(auth)/login/page");
        return;
      }

      const formData = new FormData();

      formData.append("description", description);
      formData.append("latitude", location.latitude.toString());
      formData.append("longitude", location.longitude.toString());

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
        setDescription("");
      } else if (response.status === 401) {

  Alert.alert("Session expired", "Please login again.");

  router.replace("/(auth)/login/page");

} 
else {
  Alert.alert("Error", JSON.stringify(data));
}
    } catch (error) {
      Alert.alert("Network Error", (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Take / Select Photo" onPress={pickImage} />

      {image && <Image source={{ uri: image.uri }} style={styles.image} />}

      <View style={styles.locationContainer}>
        <TextInput
          style={styles.locationInput}
          placeholder="Enter landmark/address or select map"
          value={locationText}
          onChangeText={setLocationText}
          editable={true}
        />

        <TouchableOpacity onPress={openMap}>
          <Ionicons name="map" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        <Button title="Search Address" onPress={resolveLocationFromText} />
        <Button title="Use Current Location" onPress={getLocation} />
      </View>

      <TextInput
        style={styles.description}
        placeholder="Describe the situation..."
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <Button title="Submit Report" onPress={submitReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 40,
  },

  image: {
    height: 200,
    marginVertical: 15,
    borderRadius: 10,
  },

  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginVertical: 15,
  },

  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  locationInput: {
    flex: 1,
    paddingVertical: 10,
  },

  description: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginVertical: 20,
    height: 120,
    textAlignVertical: "top",
  },
});
