import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";

// Keep the native splash up until the fonts are ready, so no screen renders in the wrong font.
SplashScreen.preventAutoHideAsync().catch(() => null);

// expo-notifications is an optional dep — it's installed as part of the production build flow.
// During Expo Go development it may not be present; all push-notification code is guarded.
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}

async function setupPushNotifications() {
  if (!Notifications) return;
  const { registerForPushNotifications, sendPushTokenToBackend } = await import(
    "../services/notificationService"
  );
  const token = await registerForPushNotifications();
  if (token) await sendPushTokenToBackend(token);
}

export default function RootLayout() {
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => null);
  }, [fontsReady]);

  useEffect(() => {
    // Set up push notifications when the package is available.
    setupPushNotifications().catch(() => null);

    if (Notifications) {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        // Foreground notification received — handler in notificationService shows it.
      });
      responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
        // User tapped notification — deep-link routing can be added here.
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!fontsReady) return null;

  // Keep navigation chrome inside each screen so mobile layouts stay flexible.
  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: "fade" }}>
      {/* The sign-in sheet sits over the current screen, which stays visible behind the dim. */}
      <Stack.Screen
        name="auth-sheet"
        options={{ presentation: "transparentModal", animation: "fade", contentStyle: { backgroundColor: "transparent" } }}
      />
    </Stack>
  );
}
