import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type PickedPhoto = { uri: string; name: string; type: string };

// Takes a photo or picks one from the gallery, asking for access first.
// Returns null when the person cancels or refuses access.
export async function pickPhoto(source: "camera" | "library", why = "add a photo"): Promise<PickedPhoto | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      source === "camera" ? "Camera access needed" : "Photo access needed",
      `Allow access in your phone's settings to ${why}.`
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
  const result =
    source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName || "photo.jpg", type: asset.mimeType || "image/jpeg" };
}
