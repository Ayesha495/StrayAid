import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, type } from "../../../theme/tokens";

// Placeholder until the rescue map and search (Stitch screen 12) are built.
export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <Text style={styles.title} accessibilityRole="header">
        Explore
      </Text>
      <View style={styles.empty}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="map" size={32} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>The rescue map is on its way</Text>
        <Text style={styles.emptyBody}>Search and nearby rescue cases on a map will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  title: { ...type.headlineLg, color: colors.ink, paddingHorizontal: 20, paddingTop: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { ...type.headlineSm, color: colors.ink, textAlign: "center" },
  emptyBody: { ...type.bodyMd, color: colors.inkMuted, textAlign: "center" },
});
