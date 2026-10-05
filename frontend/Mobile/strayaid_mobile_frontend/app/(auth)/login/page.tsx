import { MaterialIcons } from "@expo/vector-icons";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GoogleButton, PrimaryButton } from "../../../components/auth/AuthButtons";
import AuthField from "../../../components/auth/AuthField";
import AuthHeader, { leaveAuth } from "../../../components/auth/AuthHeader";
import { loginUser } from "../../../services/authService";
import { useGoogleAuth } from "../../../services/googleAuthService";
import { colors, fonts } from "../../../theme/tokens";

// Stitch screen 5: Sign In. After signing in, people return to whatever they were doing.

export default function LoginPage() {
  const params = useLocalSearchParams<{ email?: string; reset?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"email" | "password" | "both" | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const { request: googleRequest, promptAsync: promptGoogle } = useGoogleAuth({
    onSuccess: () => {
      setGoogleBusy(false);
      leaveAuth();
    },
    onError: (message) => {
      setGoogleBusy(false);
      setError(message);
    },
  });

  // Coming back from "Forgot password?" after a successful reset.
  useEffect(() => {
    if (params.reset !== "done") return;
    if (params.email) setEmail(params.email);
    setPassword("");
    setNotice("Password updated. Sign in with your new password.");
  }, [params.reset, params.email]);

  const clearError = () => {
    setError(null);
    setInvalidField(null);
  };

  const signIn = async () => {
    if (signingIn) return;
    if (!email.trim()) {
      setInvalidField("email");
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setInvalidField("password");
      setError("Enter your password.");
      passwordRef.current?.focus();
      return;
    }

    clearError();
    setNotice(null);
    setSigningIn(true);
    try {
      await loginUser({ email, password });
      leaveAuth();
    } catch (err) {
      setInvalidField("both");
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const continueWithGoogle = async () => {
    clearError();
    setGoogleBusy(true);
    const result = await promptGoogle().catch(() => null);
    // Cancelled or dismissed: nothing else will reset the spinner.
    if (result?.type !== "success") setGoogleBusy(false);
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
          <AuthHeader />

          <Text style={styles.title} accessibilityRole="header">
            Welcome back
          </Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <AuthField
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) clearError();
              }}
              invalid={invalidField === "email" || invalidField === "both"}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AuthField
              ref={passwordRef}
              label="Password"
              placeholder="••••••••"
              secure
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) clearError();
              }}
              invalid={invalidField === "password" || invalidField === "both"}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={signIn}
            />

            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { email: email.trim() } } as Href)}
              hitSlop={8}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          {notice && !error && (
            <View style={[styles.banner, styles.notice]} accessibilityLiveRegion="polite">
              <MaterialIcons name="check-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.bannerText, styles.noticeText]}>{notice}</Text>
            </View>
          )}

          {error && (
            <View style={[styles.banner, styles.error]} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={[styles.bannerText, styles.errorText]}>{error}</Text>
            </View>
          )}

          <View style={[styles.actions, (error || notice) && styles.actionsAfterBanner]}>
            <PrimaryButton label="Sign In" onPress={signIn} loading={signingIn} disabled={googleBusy} />
            <GoogleButton onPress={continueWithGoogle} loading={googleBusy} disabled={!googleRequest || signingIn} />
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.replace("/(auth)/register/page" as Href)}
              hitSlop={8}
              style={styles.createAccount}
            >
              <Text style={styles.createAccountText}>Create account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 12 },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 27,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: colors.ink,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: 2 },
  form: { marginTop: 28, gap: 16 },
  forgot: { alignSelf: "flex-end", marginTop: -2, paddingVertical: 4, paddingHorizontal: 8 },
  forgotText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20, color: colors.inkMuted },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bannerText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  error: { backgroundColor: colors.criticalSoft },
  errorText: { color: "#B4483A" },
  notice: { backgroundColor: colors.mint },
  noticeText: { color: colors.primary },
  actions: { marginTop: 24, gap: 24 },
  actionsAfterBanner: { marginTop: 16 },
  footer: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingTop: 32 },
  createAccount: { paddingVertical: 8, paddingHorizontal: 12 },
  createAccountText: { fontFamily: fonts.bodySemiBold, fontSize: 14, letterSpacing: -0.2, color: colors.primary },
});
