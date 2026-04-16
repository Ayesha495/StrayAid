import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { registerUser } from "../../../services/authService";

const palette = {
  white: "#ffffff",
  cream: "#f7faf9",
  teal: "#0f766e",
  amber: "#d97706",
  ink: "#172033",
  muted: "#6e6458",
};

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !rePassword.trim()) {
      Alert.alert("Missing details", "Fill in all fields to continue.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await registerUser({
        username,
        email,
        password,
        re_password: rePassword,
      });

      if (result.id) {
        Alert.alert("Account created", "You can log in now.");
        router.replace("/login/index");
      } else {
        Alert.alert("Registration failed", JSON.stringify(result));
      }
    } catch (err: any) {
      Alert.alert("Registration failed", err.message);
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Join StrayAid</Text>
            <Text style={styles.title}>Create your account before you start reporting cases.</Text>
          </View>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={palette.muted}
              value={username}
              onChangeText={setUsername}
            />
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
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={palette.muted}
              secureTextEntry
              value={rePassword}
              onChangeText={setRePassword}
            />

            <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={isSubmitting}>
              <Text style={styles.primaryButtonText}>{isSubmitting ? "Creating..." : "Create account"}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => router.replace("/login/index")}>
              <Text style={styles.secondaryButtonText}>Back to login</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 24,
  },
  hero: {
    gap: 10,
    marginTop: 18,
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
  card: {
    backgroundColor: palette.cream,
    borderRadius: 28,
    padding: 22,
    gap: 14,
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
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: palette.amber,
    fontSize: 15,
    fontWeight: "700",
  },
});
