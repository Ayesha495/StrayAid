import { Tabs } from "expo-router";

import TabBar from "../../components/navigation/TabBar";

// Guests can browse Home and Explore; the tab bar sends them to sign in for the rest.
export default function TabLayout() {
  return (
    <Tabs initialRouteName="home/index" tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home/index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore/index" options={{ title: "Explore" }} />
      <Tabs.Screen name="report-tab/index" options={{ title: "Report" }} />
      <Tabs.Screen name="activity/index" options={{ title: "Activity" }} />
      <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
    </Tabs>
  );
}
