import { MaterialIcons } from "@expo/vector-icons";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/auth/AuthButtons";
import AuthField from "../../components/auth/AuthField";
import AuthHeader from "../../components/auth/AuthHeader";
import { confirmPasswordReset, requestPasswordReset } from "../../services/authService";
import { colors, fonts } from "../../theme/tokens";

// "Forgot password?" from Stitch screen 5. There is no Stitch screen for it, so it reuses the
// sign-in layout: step 1 emails a 6-digit code, step 2 sets a new password with that code.

const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    if (busy) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      passwordRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await confirmPasswordReset(email, code, password);
      // Back to Sign In (it stays underneath), with the email filled in and a success note.
      router.dismissTo({ pathname: "/(auth)/login/page", params: { email: email.trim(), reset: "done" } } as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't reset your password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (step === "code") {
      setStep("email");
      setError(null);
      setCode("");
      setPassword("");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/login/page" as Href);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader onBack={goBack} />

          {step === "email" ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Reset password
              </Text>
              <Text style={styles.subtitle}>Enter your account email and we&apos;ll send you a 6-digit code.</Text>

              <View style={styles.form}>
                <AuthField
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  invalid={!!error}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Check your email
              </Text>
              <Text style={styles.subtitle}>
                If <Text style={styles.subtitleStrong}>{email.trim()}</Text> has a StrayAid account, a 6-digit code is
                on its way. It expires in 15 minutes.
              </Text>

              <View style={styles.form}>
                <AuthField
                  label="6-digit code"
                  placeholder="123456"
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={styles.codeInput}
                />
                <AuthField
                  ref={passwordRef}
                  label="New password"
                  placeholder="At least 8 characters"
                  secure
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={resetPassword}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={sendCode}
                  disabled={resendIn > 0 || busy}
                  hitSlop={8}
                  style={styles.resend}
                >
                  <Text style={[styles.resendText, resendIn > 0 && styles.resendWaiting]}>
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {error && (
            <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {step === "email" ? (
              <PrimaryButton label="Send code" onPress={sendCode} loading={busy} />
            ) : (
              <PrimaryButton label="Reset password" onPress={resetPassword} loading={busy} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 27, lineHeight: 37, letterSpacing: -0.7, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: 2 },
  subtitleStrong: { fontFamily: fonts.bodySemiBold, color: colors.ink },
  form: { marginTop: 28, gap: 16 },
  codeInput: { fontFamily: fonts.bodySemiBold, fontSize: 18, letterSpacing: 6 },
  resend: { alignSelf: "flex-end", marginTop: -2, paddingVertical: 4, paddingHorizontal: 8 },
  resendText: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 20, color: colors.primary },
  resendWaiting: { fontFamily: fonts.bodyMedium, color: colors.inkMuted },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.criticalSoft,
  },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#B4483A" },
  actions: { marginTop: 24 },
});
