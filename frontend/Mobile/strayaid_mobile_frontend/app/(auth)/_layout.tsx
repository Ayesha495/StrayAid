import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router } from "expo-router";
import { getToken } from "../../utils/tokenStorage";

export default function AuthLayout() {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      const token = await getToken();
      if (token) {
        router.replace("/feed/index");
        return;
      }
      setIsChecking(false);
    };

    redirectIfAuthenticated();
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
