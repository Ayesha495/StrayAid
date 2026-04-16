import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";
const USER_KEY = "currentUser";

export async function getToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem(ACCESS_KEY);
  }
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem(REFRESH_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveSession(access: string, refresh?: string, user?: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_KEY, refresh);
    }
    if (user) {
      localStorage.setItem(USER_KEY, user);
    }
    return;
  }

  await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) {
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  }
  if (user) {
    await SecureStore.setItemAsync(USER_KEY, user);
  }
}

export async function getStoredUser() {
  const rawUser = Platform.OS === "web"
    ? localStorage.getItem(USER_KEY)
    : await SecureStore.getItemAsync(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export async function clearSession() {
  if (Platform.OS === "web") {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
