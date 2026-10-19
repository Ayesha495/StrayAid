import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../../theme/tokens";
import LogoMark from "./Logo";

// "STRAYAID RESCUE / Activity" title with the logo badge, as on the Stitch tab screens.
export function BrandTitle({ title }: { title: string }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={`StrayAid, ${title}`}>
      <View style={styles.badge}>
        <LogoMark size={26} color={colors.primary} />
      </View>
      <View>
        <Text style={styles.eyebrow}>STRAYAID RESCUE</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

// The logo in a soft circle, for welcome and "all caught up" moments.
export function BrandBadge({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <LogoMark size={size * 0.56} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#89F7CB", alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.2, color: colors.primary },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 19, lineHeight: 24, color: "#0B1C2E" },
  circle: { backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
