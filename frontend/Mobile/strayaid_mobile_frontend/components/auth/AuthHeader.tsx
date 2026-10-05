import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import LogoMark from "../brand/Logo";
import { colors, fonts } from "../../theme/tokens";

// Back chevron, logo tile and wordmark at the top of the sign-in style screens.
// Stitch 5 stacks the logo under the chevron; Stitch 6 (`inline`) puts them on one row.

type Props = {
  onBack?: () => void;
  inline?: boolean;
};

// Leave the auth screen: back to whatever opened it, or Home if nothing did.
export function leaveAuth() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/home");
}

export default function AuthHeader({ onBack = leaveAuth, inline }: Props) {
  return (
    <View style={inline && styles.inlineRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, inline && styles.backInline, pressed && styles.backPressed]}
      >
        <MaterialIcons name="chevron-left" size={inline ? 28 : 32} color={colors.ink} />
      </Pressable>

      <View style={[styles.brand, inline && styles.brandInline]} accessible accessibilityLabel="StrayAid">
        <View style={[styles.tile, inline && styles.tileInline]}>
          <LogoMark size={inline ? 22 : 24} />
        </View>
        <Text style={[styles.wordmark, inline && styles.wordmarkInline]}>StrayAid</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 40,
    height: 40,
    marginLeft: -12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineRow: { flexDirection: "row", alignItems: "center", paddingTop: 4, paddingBottom: 12 },
  backInline: { width: 32, height: 32, borderRadius: 16, marginLeft: -6, marginTop: 0, marginBottom: 0 },
  backPressed: { backgroundColor: "#F3F4F6" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  brandInline: { marginLeft: 8, marginBottom: 0, gap: 8 },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#064E3B",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tileInline: { width: 32, height: 32, borderRadius: 8 },
  wordmark: { fontFamily: fonts.displayExtraBold, fontSize: 23, letterSpacing: -0.6, color: colors.ink },
  wordmarkInline: { fontSize: 20, letterSpacing: -0.5 },
});
