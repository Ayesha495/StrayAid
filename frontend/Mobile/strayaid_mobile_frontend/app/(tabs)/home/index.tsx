import React, { useState } from "react";
import { View, TextInput, Button, Image, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { getToken } from "../../../utils/tokenStorage";
import { router } from "expo-router";

export default function ReportScreen() {
  const API_BASE = process.env.IP || 'http://192.168.1.14:8000';
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [description, setDescription] = useState("");

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Camera permission is needed.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0]);
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission denied", "Location permission is required.");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const submitReport = async () => {
    if (!image) {
      Alert.alert("Missing Image", "Please take a photo first.");
      return;
    }

    if (!location) {
      Alert.alert("Missing Location", "Please fetch location first.");
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

      const response = await fetch(
        
        `${API_BASE}/api/cases/report/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Report submitted successfully.");
      } else {
        Alert.alert("Error", JSON.stringify(data));
      }
    } catch (error) {
      Alert.alert("Network Error", (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Take Photo" onPress={pickImage} />

      <Button title="Get Location" onPress={getLocation} />

      <TextInput
        style={styles.input}
        placeholder="Describe the situation"
        value={description}
        onChangeText={setDescription}
      />

      {image && (
        <Image source={{ uri: image.uri }} style={styles.image} />
      )}

      <Button title="Submit Report" onPress={submitReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 40,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 15,
    borderRadius: 5,
  },
  image: {
    height: 200,
    marginBottom: 20,
  },
});