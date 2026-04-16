import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { loginUser } from "../../../services/authService";

const palette = {
  white: "#ffffff",
  cream: "#f7faf9",
  teal: "#0f766e",
  amber: "#d97706",
  ink: "#172033",
  muted: "#6e6458",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing details", "Enter your email and password first.");
      return;
    }

    try {
      setIsSubmitting(true);
      await loginUser({ email, password });
      router.replace("/feed/index");
    } catch (err: any) {
      Alert.alert("Login failed", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>StrayAid Mobile</Text>
          <Text style={styles.title}>Sign in before you report, track, or manage cases.</Text>
          <Text style={styles.subtitle}>
            Keep every report linked to your account so you can follow what happens next.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={palette.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? "Signing in..." : "Login"}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push("/register/index")}>
            <Text style={styles.secondaryButtonText}>Create an account</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.white,
  },
  keyboard: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: "space-between",
  },
  hero: {
    paddingTop: 18,
    gap: 10,
  },
  eyebrow: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: palette.cream,
    borderRadius: 28,
    padding: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: palette.ink,
    borderWidth: 1,
    borderColor: "#e8dccd",
  },
  primaryButton: {
    backgroundColor: palette.teal,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: palette.amber,
    fontSize: 15,
    fontWeight: "700",
  },
});
