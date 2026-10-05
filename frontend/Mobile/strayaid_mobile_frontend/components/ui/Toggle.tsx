import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { colors } from "../../theme/tokens";

// iOS-style switch from the Stitch screens (44x24 track, Rescue Green when on). Drawn by hand
// so it looks the same on Android and iOS.

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
};

export default function Toggle({ value, onChange, label, disabled }: Props) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [position, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      onPress={() => onChange(!value)}
      disabled={disabled}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: position.interpolate({ inputRange: [0, 1], outputRange: ["#CBD5E1", colors.primary] }) },
        ]}
      >
        <Animated.View
          style={[styles.knob, { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: { opacity: 0.6 },
});
