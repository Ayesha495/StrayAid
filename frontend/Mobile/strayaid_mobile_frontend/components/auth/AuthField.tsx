import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors, fonts } from "../../theme/tokens";

// Labelled text field used by the sign-in, sign-up and password-reset screens (Stitch 5, 6).
// `secure` adds the Show / Hide toggle on the right. `compact` is the smaller white field
// from the sign-up screen; the default is the taller grey one from sign-in.
// `error` shows a message under the field and marks it red.
// `revealed` / `onRevealChange` let one toggle reveal several fields (password + confirm);
// `hideToggle` drops the Show button from a field that follows another one.

type Props = TextInputProps & {
  label: string;
  secure?: boolean;
  invalid?: boolean;
  error?: string;
  compact?: boolean;
  revealed?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  hideToggle?: boolean;
};

const AuthField = forwardRef<TextInput, Props>(function AuthField(
  { label, secure, invalid, error, compact, revealed, onRevealChange, hideToggle, style, onFocus, onBlur, ...inputProps },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hiddenState, setHiddenState] = useState(true);
  const hidden = revealed === undefined ? hiddenState : !revealed;
  const toggleHidden = () => {
    setHiddenState(!hidden);
    onRevealChange?.(hidden);
  };
  const masked = secure && hidden && !!inputProps.value;

  return (
    <View style={[styles.group, compact && styles.groupCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <View
        style={[
          styles.box,
          compact && styles.boxCompact,
          focused && styles.boxFocused,
          (invalid || !!error) && styles.boxInvalid,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          secureTextEntry={secure && hidden}
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            compact && styles.inputCompact,
            secure && !hideToggle && styles.inputWithToggle,
            masked && styles.inputMasked,
            style,
          ]}
          {...inputProps}
        />
        {secure && !hideToggle && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            onPress={toggleHidden}
            hitSlop={8}
            style={[styles.toggle, compact && styles.toggleCompact]}
          >
            <Text style={[styles.toggleText, compact && styles.toggleTextCompact]}>{hidden ? "Show" : "Hide"}</Text>
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
});

export default AuthField;

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupCompact: { gap: 4 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 19.5, letterSpacing: -0.2, color: colors.ink },
  labelCompact: { fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  box: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
  },
  boxCompact: {
    height: 42,
    borderColor: "#E8ECEB",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  boxFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  boxInvalid: { borderColor: colors.critical },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  inputCompact: { paddingHorizontal: 14, fontFamily: fonts.bodyMedium },
  inputWithToggle: { paddingRight: 64 },
  // The dots read better spaced out, as in the reference; typed text stays normal.
  inputMasked: { fontSize: 15, letterSpacing: 1.5 },
  toggle: { position: "absolute", right: 16, height: "100%", justifyContent: "center" },
  toggleText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.inkMuted },
  toggleCompact: { right: 14 },
  toggleTextCompact: { fontSize: 12 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#B4483A" },
});
