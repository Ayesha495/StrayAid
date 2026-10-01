import { router, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../../styles/mobileTheme";

export default function TabLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync("access");
      if (!token) {
        router.replace("/(auth)/login/page");
        return;
      }
      setReady(true);
    };

    checkAuth().catch(() => router.replace("/(auth)/login/page"));
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceMuted }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <Tabs
      initialRouteName="feed/index"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        headerShown: false,
        tabBarStyle: {
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0.5,
          borderTopColor: theme.colors.border,
          shadowColor: theme.colors.primaryDeep,
          shadowOpacity: 0.1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
      }}>

      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? "home" : "home-outline"} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="report/index"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                shadowColor: theme.colors.primary,
                shadowOpacity: 0.4,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 10,
              }}
            >
              <Ionicons size={26} name="camera" color="#ffffff" />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="activity/index"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? "heart" : "heart-outline"} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? "person" : "person-outline"} color={color} />
          ),
        }}
      />

      <Tabs.Screen name="home/index" options={{ href: null }} />
    </Tabs>
  );
}
