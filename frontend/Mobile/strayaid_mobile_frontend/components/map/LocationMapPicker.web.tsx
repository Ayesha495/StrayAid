import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/tokens";

// Web fallback for LocationMapPicker.tsx: react-native-maps depends on native-only
// RN internals and cannot be transformed for the web bundle.
export default function LocationMapPicker() {
  return (
    <View style={[styles.map, styles.centered]}>
      <Text style={styles.helper}>
        Map location picking is only available in the mobile app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 24 },
  helper: { color: colors.inkMuted, lineHeight: 21, textAlign: "center" },
});
