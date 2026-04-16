import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getToken } from "../utils/tokenStorage";

export default function Index() {

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();

      if (token) {
        router.replace("/feed/index");
      } else {
        router.replace("/login/index");
      }

    };

    checkAuth();
  }, []);

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center", backgroundColor: "#ffffff"}}>
      <ActivityIndicator color="#0f766e" />
    </View>
  );
}
