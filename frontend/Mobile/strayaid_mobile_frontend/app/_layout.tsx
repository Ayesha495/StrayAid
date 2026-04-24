import { Stack } from "expo-router";

export default function RootLayout() {
    // Keep navigation chrome inside each screen so mobile layouts stay flexible.
    return <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: "fade" }} />;
}
