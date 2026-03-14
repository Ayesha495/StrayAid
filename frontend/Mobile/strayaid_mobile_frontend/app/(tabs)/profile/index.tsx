import { View, Button } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export default function ProfilePage() {
    const handleLogout = async () => {
        await SecureStore.deleteItemAsync("accessToekn");
        router.replace("/(auth)/login/page");
    };


return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Button title="Logout" onPress={handleLogout} />
    </View>
);
}