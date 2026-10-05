import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "../../theme/tokens";

// Header for the pages opened from a case (Case Updates, Related Reports). Same back button
// and centred title as the case page (Stitch 10).

export default function CaseSubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.nav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <MaterialIcons name="chevron-left" size={26} color="#243447" />
      </Pressable>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECE9",
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "#F1F5F9" },
  titleBlock: { flex: 1, alignItems: "center" },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 14, lineHeight: 20, letterSpacing: -0.3, color: "#243447" },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: "#747474" },
  spacer: { width: 36, height: 36 },
});
