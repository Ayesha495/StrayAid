import React from "react";
import { View, Text } from "react-native";
import { mapSelectStyles as styles } from "../styles/MapSelectStyles";

// Web fallback for LocationMapPicker.tsx: react-native-maps depends on native-only
// RN internals and cannot be transformed for the web bundle.
export default function LocationMapPicker() {
  return (
    <View style={[styles.map, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
      <Text style={styles.helper}>
        Map location picking is only available in the mobile app.
      </Text>
    </View>
  );
}
