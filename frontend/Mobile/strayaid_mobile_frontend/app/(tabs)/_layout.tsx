import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { getToken } from "@/utils/tokenStorage";

const palette = {
  white: "#ffffff",
  clay: "#d97706",
  teal: "#0f766e",
  ink: "#172033",
  mist: "#f5fffd",
  muted: "#857869",
};

export default function TabLayout() {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const ensureAuthenticated = async () => {
      const token = await getToken();
      if (!token) {
        router.replace("/login/index");
        return;
      }
      setIsChecking(false);
    };

    ensureAuthenticated();
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.white }}>
        <ActivityIndicator size="large" color={palette.teal} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 72,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: palette.teal,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: palette.white,
        tabBarInactiveTintColor: "#cbe5e2",
        sceneStyle: {
          backgroundColor: palette.white,
        },
      }}
    >
      <Tabs.Screen
        name="feed/index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "newspaper" : "newspaper-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Submit",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
