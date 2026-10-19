import Constants from "expo-constants";
import { Platform } from "react-native";

// Resolves the backend API base URL.
// 1. A hosted backend in EXPO_PUBLIC_API_URL (https:// or a domain name) always wins.
// 2. In development, the app talks to the Expo dev server it was loaded from; metro.config.js
//    forwards /api, /auth and /media requests from there to Django on the same computer.
//    Nothing has to change when the Wi-Fi IP changes, and it also works with --tunnel.
// 3. Otherwise EXPO_PUBLIC_API_URL as given, then localhost:8000 (10.0.2.2 on the Android emulator).
function resolveApiBase(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const isLocalUrl = (url: string) => /:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:|\/|$)/.test(url);

  if (envUrl && (envUrl.startsWith("https://") || !isLocalUrl(envUrl))) {
    return envUrl;
  }

  // "192.168.1.5:8081" on LAN, "xyz-anonymous-8081.exp.direct" with --tunnel.
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  // The web build is served by Expo's own web middleware, so it calls Django directly.
  if (hostUri && Platform.OS !== "web") {
    const [host, port] = hostUri.split(":");
    const isTunnel = /exp\.direct|ngrok/.test(host);
    const reachableHost =
      Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1") ? "10.0.2.2" : host;
    return `${isTunnel ? "https" : "http"}://${reachableHost}${port ? `:${port}` : ""}`;
  }

  if (envUrl) return envUrl;

  const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return `http://${defaultHost}:8000`;
}

export const API_BASE = resolveApiBase();
