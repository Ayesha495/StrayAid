import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "998658289609-u4an6pas5lcpg578tb3c1rhdre8g5eji.apps.googleusercontent.com",
    iosClientId: "998658289609-1g2mm1bre24hlccle05gmon0c416h44v.apps.googleusercontent.com",
    clientId: "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      fetchUserInfo(response.authentication?.accessToken);
    }
  }, [response]);

  async function fetchUserInfo(token?: string | null) {
    if (!token) return;
    const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await res.json();
    console.log("User:", user);
  }

  return { request, promptAsync };
}