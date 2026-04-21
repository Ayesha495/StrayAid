import React, { useState, useEffect } from "react";
import { View, Alert, Text, Pressable } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mapSelectStyles as styles } from "../../styles/MapSelectStyles";

export default function SelectLocationScreen() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [markerPosition, setMarkerPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    getInitialLocation();
  }, []);

  const getInitialLocation = async () => {
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
    setMarkerPosition({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerPosition({ latitude, longitude });
  };

  const confirmLocation = async () => {
    if (!markerPosition) {
      Alert.alert("Error", "Please select a location on the map.");
      return;
    }

    // Store the selected location in AsyncStorage
    await AsyncStorage.setItem(
      "selectedLocation",
      JSON.stringify(markerPosition)
    );
    
    Alert.alert("Success", "Location selected!");
    router.back();
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onPress={handleMapPress}
        >
          {markerPosition && (
            <Marker
              coordinate={markerPosition}
              title="Selected Location"
              description="Pinned location"
            />
          )}
        </MapView>
      )}

      <View style={styles.bottomPanel}>
        <Text style={styles.title}>Pin The Exact Location</Text>
        <Text style={styles.helper}>Tap the map to reposition the marker, then confirm when it matches the animal&apos;s location.</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={confirmLocation}>
            <Text style={styles.primaryButtonText}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
