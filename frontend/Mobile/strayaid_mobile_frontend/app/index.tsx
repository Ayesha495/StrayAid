import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

export default function Index() {
  useEffect(() => {
    const checkAuth = async () => {
      const token = await SecureStore.getItemAsync("access");

      if (token) {
        router.replace("/(tabs)/feed");
      } else {
        router.replace("/(auth)/login/page");
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
      <ActivityIndicator />
    </View>
  );
}
