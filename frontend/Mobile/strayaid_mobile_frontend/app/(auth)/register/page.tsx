import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../../components/auth/AuthButtons";
import AuthField from "../../../components/auth/AuthField";
import AuthHeader, { leaveAuth } from "../../../components/auth/AuthHeader";
import { loginUser, registerUser, SignUpError } from "../../../services/authService";
import { colors, fonts } from "../../../theme/tokens";

// Stitch screen 6: Sign Up. Creating the account also signs the person in, and they return
// to whatever they were doing.

type Field = "fullName" | "email" | "password" | "rePassword";
type Photo = { uri: string; name: string; type: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const rePasswordRef = useRef<TextInput>(null);

  const edit = (field: Field, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (formError) setFormError(null);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access in your phone's settings to add a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, name: asset.fileName || "avatar.jpg", type: asset.mimeType || "image/jpeg" });
    setFormError(null);
  };

  const onPhotoPress = () => {
    if (!photo) {
      pickPhoto();
      return;
    }
    Alert.alert("Profile photo", undefined, [
      { text: "Choose another", onPress: pickPhoto },
      { text: "Remove photo", style: "destructive", onPress: () => setPhoto(null) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!fullName.trim()) next.fullName = "Enter your full name.";
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    else if (rePassword !== password) next.rePassword = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const createAccount = async () => {
    if (submitting || !validate()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await registerUser({ fullName, email, password, rePassword, avatar: photo });
    } catch (err) {
      if (err instanceof SignUpError) {
        const { fullName: nameError, email: emailError, password: passwordError, avatar } = err.fields;
        setErrors({ fullName: nameError, email: emailError, password: passwordError });
        if (!nameError && !emailError && !passwordError) setFormError(avatar || err.message);
      } else {
        setFormError("We couldn't create your account. Please try again.");
      }
      setSubmitting(false);
      return;
    }

    try {
      await loginUser({ email, password });
      leaveAuth();
    } catch {
      // The account exists; if the automatic sign-in fails, let them sign in by hand.
      router.replace({ pathname: "/(auth)/login/page", params: { email: email.trim() } } as Href);
    } finally {
      setSubmitting(false);
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
          <View style={styles.nav}>
            <AuthHeader inline />
          </View>

          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Create your account
            </Text>
            <Text style={styles.subtitle}>Join a community that cares</Text>
          </View>

          <View style={styles.photoSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo ? "Change profile photo" : "Add profile photo"}
              onPress={onPhotoPress}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={[styles.avatar, photo && styles.avatarFilled]}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <MaterialIcons name="person" size={44} color="rgba(30,107,86,0.45)" />
                )}
              </View>
              <View style={styles.badge}>
                <MaterialIcons name={photo ? "edit" : "add"} size={14} color={colors.onPrimary} />
              </View>
            </Pressable>
            <Pressable onPress={onPhotoPress} hitSlop={6} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={styles.photoLabel}>{photo ? "Change photo" : "Add photo"}</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <AuthField
              compact
              label="Full name"
              placeholder="e.g. Ayesha Tabassum"
              value={fullName}
              onChangeText={edit("fullName", setFullName)}
              error={errors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <AuthField
              compact
              ref={emailRef}
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={edit("email", setEmail)}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AuthField
              compact
              ref={passwordRef}
              label="Password"
              placeholder="••••••••••••"
              secure
              revealed={showPasswords}
              onRevealChange={setShowPasswords}
              value={password}
              onChangeText={edit("password", setPassword)}
              error={errors.password}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => rePasswordRef.current?.focus()}
            />
            <AuthField
              compact
              ref={rePasswordRef}
              label="Confirm password"
              placeholder="••••••••••••"
              secure
              hideToggle
              revealed={showPasswords}
              value={rePassword}
              onChangeText={edit("rePassword", setRePassword)}
              error={errors.rePassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={createAccount}
            />
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          {formError && (
            <View style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}
          <PrimaryButton label="Create account" onPress={createAccount} loading={submitting} compact />
          <Text style={styles.terms}>
            By creating an account, you agree to our{" "}
            <Text style={styles.termsLink} accessibilityRole="link" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })}>
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text style={styles.termsLink} accessibilityRole="link" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR = 80;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 8 },
  nav: { paddingHorizontal: 20 },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.inkMuted, marginTop: 4 },
  photoSection: { alignItems: "center", marginVertical: 16 },
  pressed: { opacity: 0.85 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(30,107,86,0.4)",
    backgroundColor: "rgba(231,244,238,0.4)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFilled: { borderStyle: "solid", borderColor: colors.mint },
  avatarImage: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  photoLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.primary,
    marginTop: 8,
  },
  form: { paddingHorizontal: 24, marginTop: 4, gap: 14 },
  bottom: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, gap: 16, backgroundColor: colors.surface },
  formError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: -4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.criticalSoft,
  },
  formErrorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#B4483A" },
  terms: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkMuted,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  termsLink: { textDecorationLine: "underline" },
});
