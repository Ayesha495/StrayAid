import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import GoogleMark from "../brand/GoogleMark";
import { colors, fonts } from "../../theme/tokens";

// Full-width buttons shared by the sign-in style screens (Stitch 5, 6).

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // Sign-up's slightly smaller button (Stitch 6).
  compact?: boolean;
};

export function PrimaryButton({ label, onPress, loading, disabled, compact }: ButtonProps) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.primary,
        compact && styles.primaryCompact,
        pressed && styles.primaryPressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={[styles.primaryText, compact && styles.primaryTextCompact]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GoogleButton({ onPress, loading, disabled }: Omit<ButtonProps, "label" | "compact">) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.google, pressed && styles.googlePressed, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          <GoogleMark size={16} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryCompact: { height: 48 },
  primaryPressed: { backgroundColor: "#185847", transform: [{ scale: 0.99 }] },
  primaryText: { fontFamily: fonts.displayBold, fontSize: 15, letterSpacing: 0.4, color: colors.onPrimary },
  primaryTextCompact: { fontFamily: fonts.displaySemiBold, fontSize: 14, letterSpacing: 0.35 },
  google: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googlePressed: { backgroundColor: "#F9FAFB", transform: [{ scale: 0.99 }] },
  googleText: { fontFamily: fonts.displaySemiBold, fontSize: 14, color: colors.ink },
  disabled: { opacity: 0.6 },
});
