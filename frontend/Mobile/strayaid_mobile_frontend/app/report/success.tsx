import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { keepMeUpdated } from "../../services/mobileContentService";
import { registerForPushNotifications, sendPushTokenToBackend } from "../../services/notificationService";
import type { Severity } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";

// Stitch screen 9: Report submitted.

type Params = {
  reportId: string;
  caseId: string;
  reference: string;
  area: string;
  severity: Severity;
  confidence: string;
  keepUpdated: string;
};

const SEVERITY_CHIP: Record<Severity, { label: string; color: string; background: string }> = {
  low: { label: "Low severity", color: "#1E8A66", background: "#E8F7F2" },
  medium: { label: "Medium severity", color: "#B7791F", background: "#FEF6EB" },
  high: { label: "High severity", color: colors.critical, background: "#FEF0EE" },
  critical: { label: "Critical severity", color: "#B42318", background: "#FDECEC" },
};

function SuccessBadge() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.badgePulse,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.4] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
          },
        ]}
      />
      <View style={styles.badgeHalo} />
      <View style={styles.badgeCircle}>
        <MaterialIcons name="check" size={44} color={colors.onPrimary} />
      </View>
    </View>
  );
}

function backToFeed() {
  router.dismissAll();
  router.replace("/(tabs)/home");
}

export default function ReportSuccessScreen() {
  const params = useLocalSearchParams<Params>();
  const severity = SEVERITY_CHIP[params.severity] ?? SEVERITY_CHIP.medium;
  const confidence = params.confidence ? Number(params.confidence) : null;
  const [updates, setUpdates] = useState<"idle" | "saving" | "on">("idle");
  const [updatesError, setUpdatesError] = useState<string | null>(null);

  // Android back goes to the feed, never back into the submitted form.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      backToFeed();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const turnOnUpdates = async () => {
    if (updates !== "idle") return;
    setUpdates("saving");
    setUpdatesError(null);
    try {
      if (params.keepUpdated !== "1") await keepMeUpdated(Number(params.reportId));
      const token = await registerForPushNotifications();
      if (token) await sendPushTokenToBackend(token);
      setUpdates("on");
    } catch (err) {
      setUpdates("idle");
      setUpdatesError(err instanceof Error ? err.message : "We couldn't turn on updates. Please try again.");
    }
  };

  // The case page replaces this screen, so its back button returns to the tabs.
  const viewCase = () => router.replace(`/cases/${params.caseId}` as Href);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to feed"
          onPress={backToFeed}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={28} color="#1A2421" />
        </Pressable>
      </View>

      <View style={styles.main}>
        <SuccessBadge />

        <Text style={styles.title} accessibilityRole="header">
          Report submitted!
        </Text>
        <Text style={styles.reference}>Case #{params.reference}</Text>

        <View style={styles.card}>
          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <MaterialCommunityIcons name="map-marker-outline" size={17} color={colors.primary} />
            </View>
            <Text style={styles.locationText} numberOfLines={2}>
              {params.area || "Location pinned on the map"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: severity.background }]}>
              <MaterialIcons name="star-outline" size={15} color={severity.color} />
              <Text style={[styles.chipText, { color: severity.color }]}>{severity.label}</Text>
            </View>
            {/* Only shown once the image detector has scored the case. */}
            {confidence != null && (
              <View style={[styles.chip, styles.aiChip]}>
                <MaterialCommunityIcons name="creation" size={15} color={colors.primary} />
                <Text style={[styles.chipText, styles.aiChipText]}>AI confidence: {confidence}%</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.message}>Your report has been sent to rescue organizations nearby.</Text>
      </View>

      <View style={styles.footer}>
        {updatesError && (
          <Text style={styles.updatesError} accessibilityLiveRegion="polite">
            {updatesError}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: updates !== "idle", busy: updates === "saving" }}
          onPress={turnOnUpdates}
          disabled={updates !== "idle"}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, updates === "on" && styles.primaryDone]}
        >
          {updates === "saving" ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : updates === "on" ? (
            <>
              <MaterialIcons name="notifications-active" size={18} color={colors.onPrimary} />
              <Text style={styles.primaryText}>You&apos;ll get updates</Text>
            </>
          ) : (
            <Text style={styles.primaryText}>Keep Me Updated</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={viewCase}
          style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
        >
          <Text style={styles.secondaryText}>View Case</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={backToFeed} style={styles.tertiary}>
          <Text style={styles.tertiaryText}>Back to Feed</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F9FBFB" },
  nav: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5ECE9",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  backPressed: { backgroundColor: "#F8FAFC" },
  main: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, marginTop: -8 },
  // Only the 80px circle takes up space; the glow rings spill outside it, as in the reference.
  badge: { width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  badgePulse: { position: "absolute", width: 112, height: 112, borderRadius: 56, backgroundColor: colors.secondary },
  badgeHalo: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: colors.mint },
  badgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: "#1A2421",
    marginBottom: 8,
    textAlign: "center",
  },
  reference: {
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.mint,
    fontFamily: fonts.displayBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.primary,
    marginBottom: 24,
  },
  card: {
    alignSelf: "stretch",
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5ECE9",
    backgroundColor: colors.surface,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  locationIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, letterSpacing: -0.2, color: "#1A2421" },
  divider: { height: 1, backgroundColor: "#F0F4F2" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 },
  aiChip: { backgroundColor: "#E8F5F1" },
  aiChipText: { color: colors.primary },
  message: {
    maxWidth: 260,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 19.5,
    color: "#65736E",
    textAlign: "center",
  },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 12 },
  updatesError: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#B4483A", textAlign: "center" },
  primary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryPressed: { backgroundColor: "#175645", transform: [{ scale: 0.99 }] },
  primaryDone: { backgroundColor: colors.secondary },
  primaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.onPrimary },
  secondary: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5ECE9",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  secondaryPressed: { backgroundColor: "#F9FAFB", transform: [{ scale: 0.99 }] },
  secondaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#1A2421" },
  tertiary: { paddingVertical: 10, alignItems: "center" },
  tertiaryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#65736E" },
});
