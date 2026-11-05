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

    // The project id ties the token to this app on Expo's push service (app.json extra.eas).
    const Constants = require("expo-constants").default;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch (error) {
    // Without a token the server can't send pop-ups (the in-app inbox still works), so say why.
    console.warn("Push notifications are off on this device:", error);
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
