import { Platform } from "react-native";
import { authFetch } from "./apiClient";
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

// Follow and push-token calls are best-effort: signed out (or a dead session) means "not following".
async function signedIn() {
  return !!(await getToken());
}

export async function sendPushTokenToBackend(token: string): Promise<void> {
  if (!(await signedIn())) return;

  await authFetch("/api/notifications/register-token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => null);
}

export async function followAnimal(animalId: number): Promise<boolean> {
  if (!(await signedIn())) return false;

  const res = await authFetch(`/api/notifications/follow/animal/${animalId}/`, { method: "POST" });
  const data = await res.json();
  return data.following ?? false;
}

export async function unfollowAnimal(animalId: number): Promise<boolean> {
  if (!(await signedIn())) return false;

  const res = await authFetch(`/api/notifications/follow/animal/${animalId}/`, { method: "DELETE" });
  const data = await res.json();
  return data.following ?? false;
}

export async function followOrganization(orgId: number): Promise<boolean> {
  if (!(await signedIn())) return false;

  const res = await authFetch(`/api/notifications/follow/organization/${orgId}/`, { method: "POST" });
  const data = await res.json();
  return data.following ?? false;
}

export async function unfollowOrganization(orgId: number): Promise<boolean> {
  if (!(await signedIn())) return false;

  const res = await authFetch(`/api/notifications/follow/organization/${orgId}/`, { method: "DELETE" });
  const data = await res.json();
  return data.following ?? false;
}

export async function getFollowStatus(params: { animalId?: number; orgId?: number }): Promise<{ followingAnimal?: boolean; followingOrg?: boolean }> {
  if (!(await signedIn())) return {};

  const qs = new URLSearchParams();
  if (params.animalId) qs.set("animal_id", String(params.animalId));
  if (params.orgId) qs.set("organization_id", String(params.orgId));

  const res = await authFetch(`/api/notifications/follow-status/?${qs}`);
  const data = await res.json();
  return {
    followingAnimal: data.following_animal,
    followingOrg: data.following_organization,
  };
}
