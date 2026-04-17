import { router, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";

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
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f8fb" }}>
        <ActivityIndicator size="large" color="#1e6f9f" />
      </SafeAreaView>
    );
  }

  return (
    <Tabs
      initialRouteName="feed/index"
      screenOptions={{
        tabBarActiveTintColor: "#1e6f9f",
        tabBarInactiveTintColor: "#6d8594",
        headerShown: false,
        tabBarStyle: {
          height: 76,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          shadowColor: "#12344a",
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          marginHorizontal: 0,
        },
      }}>
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'Feed',
          tabBarLabel: "Feed",
          tabBarIcon: ({ color }) => <Ionicons size={24} name="paw-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="report/index"
        options={{
          title: 'Report',
          tabBarLabel: "Report",
          tabBarIcon: () => (
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "#1e6f9f",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 22,
                shadowColor: "#12344a",
                shadowOpacity: 0.28,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <Ionicons size={28} name="add" color="#ffffff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Ionicons size={24} name="person-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="home/index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
