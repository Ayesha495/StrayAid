import { useEffect, useRef, useState } from "react";
import { Alert, Animated, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { loginUser } from "../../../services/authService";
import { loginStyles as styles } from "../../../styles/LoginStyles";

export default function LoginPage() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  const handleLogin = async () => {
    try {
      await loginUser({ email, password });
      Alert.alert("Success", "Welcome back.");
      router.replace("/(tabs)/feed");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>StrayAid</Text>
            <Text style={styles.heroTitle}>Protect Every Stray</Text>
            <Text style={styles.heroText}>Sign in first, then step into the public feed and submit rescue reports when you spot an animal in need.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Login</Text>
            <Text style={styles.formSubtitle}>Your mobile flow starts here before the tabs navigation opens.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#6d8594"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6d8594"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Pressable style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Login</Text>
            </Pressable>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New to StrayAid?</Text>
              <Pressable onPress={() => router.push("/(auth)/register/page")}>
                <Text style={styles.footerLink}>Create an account</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
