import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export async function getToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem("access");
  } else {
    return await SecureStore.getItemAsync("access");
  }
}

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem("access", token);
  } else {
    await SecureStore.setItemAsync("access", token);
  }
}