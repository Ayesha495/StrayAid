import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// JWTs: the short-lived access token sent with requests, and the refresh token that gets a
// new access token when it expires. SecureStore on the phone, localStorage on the web build.

const ACCESS = "access";
const REFRESH = "refresh";

async function read(key: string) {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string) {
  if (Platform.OS === "web") localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function remove(key: string) {
  if (Platform.OS === "web") localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export async function getToken() {
  return read(ACCESS);
}

export async function saveToken(token: string) {
  await write(ACCESS, token);
}

export async function getRefreshToken() {
  return read(REFRESH);
}

export async function saveRefreshToken(token: string) {
  await write(REFRESH, token);
}

export async function clearToken() {
  await remove(ACCESS);
  await remove(REFRESH);
}
