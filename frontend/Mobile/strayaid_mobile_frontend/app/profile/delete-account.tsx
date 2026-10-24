import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearLocalSession, deleteAccount } from "../../services/authService";
import { colors, fonts } from "../../theme/tokens";

// Profile → Settings → Delete account. Explains what goes and what stays, then asks for
// DELETE and the password before anything happens.

export default function DeleteAccountScreen() {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const ready = confirmText.trim() === "DELETE" && !deleting;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));

  const confirm = async () => {
    if (!ready) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      await clearLocalSession();
      router.replace("/(tabs)/home");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={8} style={styles.back}>
            <MaterialIcons name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">
            Delete your account?
          </Text>
          <Text style={styles.body}>
            Your name, email, phone and photo are removed straight away, along with your follows, likes, saved posts and
            notifications.
          </Text>
          <Text style={styles.body}>
            Your reports stay on their rescue cases without your name, so rescues already under way aren&apos;t interrupted.
            This can&apos;t be undone.
          </Text>
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "delete-account" } })}
          >
            What is deleted and what is kept
          </Text>

          {error && (
            <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <MaterialIcons name="error-outline" size={16} color={colors.criticalInk} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label} nativeID="confirm-label">
            Type DELETE to confirm
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
            accessibilityLabelledBy="confirm-label"
          />

          <Text style={styles.label} nativeID="password-label">
            Your password
          </Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="Your password"
            accessibilityLabelledBy="password-label"
            accessibilityHint="Leave empty if you only ever signed in with Google."
          />
          <Text style={styles.hint}>Signed up with Google and never set a password? Leave this empty.</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityState={{ disabled: !ready, busy: deleting }}
            disabled={!ready}
            onPress={confirm}
            style={({ pressed }) => [styles.danger, !ready && styles.dangerDisabled, pressed && styles.pressed]}
          >
            {deleting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.dangerText}>Delete my account</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Keep my account" onPress={goBack} style={styles.keep}>
            <Text style={styles.keepText}>Keep my account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  bar: { paddingHorizontal: 20, paddingTop: 4 },
  back: { width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, color: colors.ink, marginBottom: 4 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: colors.primary, textDecorationLine: "underline" },
  error: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.criticalSoft },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.criticalInk },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink, marginTop: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  danger: { minHeight: 52, marginTop: 12, borderRadius: 14, backgroundColor: colors.criticalInk, alignItems: "center", justifyContent: "center" },
  dangerDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  dangerText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.onPrimary },
  keep: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  keepText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
});
