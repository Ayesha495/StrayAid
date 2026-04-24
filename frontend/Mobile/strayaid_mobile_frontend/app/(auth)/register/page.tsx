import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerUser } from "../../../services/authService";
import { useGoogleAuth } from "../../../services/googleAuthService";
import { registerStyles as styles } from "../../../styles/RegisterStyles";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const { request, promptAsync } = useGoogleAuth({
    onSuccess: async () => {
      Alert.alert("Success", "Welcome to StrayAid.");
      router.replace("/(tabs)/feed");
    },
    onError: (message) => Alert.alert("Error", message),
  });

  const handleRegister = async () => {
    try {
      const result = await registerUser({
        username,
        email,
        password,
        re_password: rePassword,
      });
      if (result.id) {
        Alert.alert("Success", "Account created.");
        router.replace("/(auth)/login/page");
      } else {
        Alert.alert("Error", JSON.stringify(result));
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Registration failed");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>Join The Mission</Text>
            <Text style={styles.heroTitle}>Create Your Account</Text>
            <Text style={styles.heroText}>Start with the public feed, report stray animals quickly, and manage your own activity from one place.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Register</Text>
            <Text style={styles.formSubtitle}>Use your basic account first, then explore the mobile feed and report workflow.</Text>
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6d8594" value={username} onChangeText={setUsername} />
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#6d8594" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6d8594" value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor="#6d8594" value={rePassword} onChangeText={setRePassword} secureTextEntry />
            <Pressable style={styles.primaryButton} onPress={handleRegister}>
              <Text style={styles.primaryButtonText}>Register</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              disabled={!request}
              onPress={() => promptAsync()}
            >
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </Pressable>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable onPress={() => router.replace("/(auth)/login/page")}>
                <Text style={styles.footerLink}>Login</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
