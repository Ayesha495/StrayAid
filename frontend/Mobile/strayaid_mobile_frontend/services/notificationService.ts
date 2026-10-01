import { Platform } from "react-native";
import { API_BASE } from "./apiConfig";
import { getToken } from "../utils/tokenStorage";

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Dynamically import so missing package doesn't crash app at startup.
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");

    if (!Device.isDevice) return null;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "StrayAid",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1e6f9f",
      });
    }

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendPushTokenToBackend(token: string): Promise<void> {
  const headers = await authHeader();
  if (!headers.Authorization) return;

  await fetch(`${API_BASE}/api/notifications/register-token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ token }),
  });
}

export async function followAnimal(animalId: number): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.Authorization) return false;

  const res = await fetch(`${API_BASE}/api/notifications/follow/animal/${animalId}/`, {
    method: "POST",
    headers,
  });
  const data = await res.json();
  return data.following ?? false;
}

export async function unfollowAnimal(animalId: number): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.Authorization) return false;

  const res = await fetch(`${API_BASE}/api/notifications/follow/animal/${animalId}/`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json();
  return data.following ?? false;
}

export async function followOrganization(orgId: number): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.Authorization) return false;

  const res = await fetch(`${API_BASE}/api/notifications/follow/organization/${orgId}/`, {
    method: "POST",
    headers,
  });
  const data = await res.json();
  return data.following ?? false;
}

export async function unfollowOrganization(orgId: number): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.Authorization) return false;

  const res = await fetch(`${API_BASE}/api/notifications/follow/organization/${orgId}/`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json();
  return data.following ?? false;
}

export async function getFollowStatus(params: { animalId?: number; orgId?: number }): Promise<{ followingAnimal?: boolean; followingOrg?: boolean }> {
  const headers = await authHeader();
  if (!headers.Authorization) return {};

  const qs = new URLSearchParams();
  if (params.animalId) qs.set("animal_id", String(params.animalId));
  if (params.orgId) qs.set("organization_id", String(params.orgId));

  const res = await fetch(`${API_BASE}/api/notifications/follow-status/?${qs}`, { headers });
  const data = await res.json();
  return {
    followingAnimal: data.following_animal,
    followingOrg: data.following_organization,
  };
}
