import { Stack } from "expo-router";
import { useEffect, useRef } from "react";

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

  // Keep navigation chrome inside each screen so mobile layouts stay flexible.
  return <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: "fade" }} />;
}
