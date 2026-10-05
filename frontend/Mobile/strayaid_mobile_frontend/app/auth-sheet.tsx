import { MaterialIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GoogleMark from "../components/brand/GoogleMark";
import { useGoogleAuth } from "../services/googleAuthService";
import { colors, fonts } from "../theme/tokens";

// Stitch screen 4: sign-in sheet shown when a guest tries something that needs an account.
// Presented as a transparent modal over whatever screen opened it.

const OFFSCREEN = Dimensions.get("window").height;
const DISMISS_DRAG = 120;

export default function AuthSheet() {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  }, [translateY]);

  // Slide the sheet away first, then leave the route (or go somewhere else).
  const close = useCallback(
    (then?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(translateY, { toValue: OFFSCREEN, duration: 200, useNativeDriver: true }).start(() => {
        if (router.canGoBack()) router.back();
        then?.();
      });
    },
    [translateY]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DRAG || gesture.vy > 1.2) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const { request: googleRequest, promptAsync: promptGoogle } = useGoogleAuth({
    onSuccess: () => close(),
    onError: (message) => Alert.alert("Google sign-in", message),
  });

  const goTo = (href: Href) => close(() => router.push(href));

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close" />

      <Animated.View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8, transform: [{ translateY }] }]}
        accessibilityViewIsModal
        {...panResponder.panHandlers}
      >
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          Help make a difference.
        </Text>
        <Text style={styles.body}>
          Create a free <Text style={styles.bodyStrong}>StrayAid</Text> account to report animals, follow rescues, chat
          with organizations, and help animals find homes.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => promptGoogle()}
            disabled={!googleRequest}
            style={({ pressed }) => [styles.googleButton, pressed && styles.googlePressed, !googleRequest && styles.disabled]}
          >
            <GoogleMark />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => goTo("/(auth)/register/page" as Href)}
            style={({ pressed }) => [styles.emailButton, pressed && styles.emailPressed]}
          >
            <MaterialIcons name="mail-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.emailText}>Continue with Email</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => goTo("/(auth)/login/page" as Href)}
          hitSlop={8}
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>Log In</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 24,
  },
  handleArea: { paddingBottom: 20, alignItems: "center", alignSelf: "stretch" },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1" },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 290,
    marginBottom: 24,
  },
  bodyStrong: { fontFamily: fonts.bodySemiBold, color: "#334155" },
  actions: { alignSelf: "stretch", gap: 12 },
  googleButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
  googlePressed: { backgroundColor: "#F8FAFC" },
  googleText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#334155" },
  emailButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emailPressed: { backgroundColor: "#165343" },
  emailText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  disabled: { opacity: 0.6 },
  loginLink: { marginTop: 16, minHeight: 32, paddingHorizontal: 12, justifyContent: "center" },
  loginText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.primary },
});
