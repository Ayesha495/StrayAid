import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  checkConnection,
  flushQueue,
  getQueue,
  getRescueContacts,
  QueuedReport,
  RescueContact,
} from "../services/offlineQueue";
import { colors, fonts } from "../theme/tokens";
import { timeAgo } from "../utils/format";

// Stitch extra screen "error_state_connection": shown when a report can't be sent because
// there's no connection. The report waits on the phone and is sent when the app is online.

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  highest: "#D3E4FD",
  green: "#1E6B56",
  mint: "#86F4C8",
  onMint: "#007153",
  fixed: "#89F7CB",
  ink: "#0B1C2E",
  soft: "#3F4945",
  tertiary: "#82271E",
  tertiaryContainer: "#A23E32",
  onTertiaryContainer: "#FFCEC7",
  tertiaryFixed: "#FFDAD5",
  errorContainer: "#FFDAD6",
};

export default function OfflineScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [queue, setQueue] = useState<QueuedReport[]>([]);
  const [contact, setContact] = useState<RescueContact | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQueue(await getQueue());
    const contacts = await getRescueContacts();
    // A verified team taking new cases first, then any team taking cases.
    setContact(
      contacts.find((item) => item.is_available && item.is_verified) ?? contacts.find((item) => item.is_available) ?? contacts[0] ?? null
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goHome = () => {
    router.dismissAll();
    router.replace("/(tabs)/home");
  };

  const retry = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      if (!(await checkConnection())) {
        setMessage("Still offline. Your reports stay saved on this phone.");
        return;
      }
      const { sent, left } = await flushQueue();
      await load();
      if (left === 0) {
        setMessage(sent ? `Back online. ${sent === 1 ? "Your report was" : `${sent} reports were`} sent.` : "You're back online.");
        setTimeout(goHome, 1400);
      } else {
        setMessage(`${sent} sent, ${left} still waiting. We'll keep trying.`);
      }
    } finally {
      setRetrying(false);
    }
  };

  const call = () => contact && Linking.openURL(`tel:${contact.phone.replace(/\s/g, "")}`).catch(() => null);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goHome} style={styles.headerButton}>
            <MaterialIcons name="arrow-back" size={24} color={C.ink} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {reason === "report" ? "Report Case" : "Connection"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.sync}>
          <View style={styles.syncLeft}>
            <MaterialIcons name="cloud-off" size={20} color={C.tertiary} />
            <View style={styles.flexShrink}>
              <Text style={styles.syncTitle}>Live Sync Offline</Text>
              <Text style={styles.syncText}>Queued data preserved securely</Text>
            </View>
          </View>
          <View style={styles.fieldPill}>
            <View style={styles.fieldDot} />
            <Text style={styles.fieldText}>Field Mode</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View>
            <View style={styles.heroOuter}>
              <View style={styles.heroInner}>
                <MaterialIcons name="signal-cellular-connected-no-internet-4-bar" size={34} color={C.tertiary} />
              </View>
            </View>
            <View style={styles.heroBadge}>
              <MaterialIcons name="priority-high" size={20} color={C.tertiary} />
            </View>
          </View>
          <Text style={styles.heading}>Something went wrong</Text>
          <Text style={styles.body}>
            Check your network connection and try again.{" "}
            {reason === "report"
              ? "Your report is saved on this phone and will be sent as soon as you're back online."
              : "If the issue persists, reports you make are kept safely on this phone until they can be sent."}
          </Text>
          <View style={styles.diagnostic}>
            <MaterialCommunityIcons name="wifi-alert" size={16} color={C.soft} />
            <Text style={styles.diagnosticText}>Can&apos;t reach StrayAid • Code ERR_NETWORK</Text>
          </View>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Pressable accessibilityRole="button" disabled={retrying} onPress={retry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            {retrying ? <ActivityIndicator color={colors.onPrimary} /> : <MaterialIcons name="refresh" size={20} color={colors.onPrimary} />}
            <Text style={styles.retryText}>{retrying ? "Checking…" : "Retry Connection"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={goHome} style={({ pressed }) => [styles.offline, pressed && styles.pressed]}>
            <MaterialIcons name="save" size={20} color={C.onMint} />
            <Text style={styles.offlineText}>Access Offline Mode</Text>
          </Pressable>
        </View>

        <View style={styles.queue}>
          <View style={styles.queueHead}>
            <View style={styles.queueTitleRow}>
              <MaterialIcons name="cached" size={18} color="#006C4F" />
              <Text style={styles.queueTitle}>Local Storage Queue</Text>
            </View>
            <Text style={styles.pending}>{queue.length} PENDING</Text>
          </View>
          {queue.length === 0 ? (
            <Text style={styles.queueEmpty}>Nothing waiting to send.</Text>
          ) : (
            queue.map((entry) => (
              <View key={entry.id} style={styles.queueItem}>
                <View style={styles.queueRow}>
                  <View style={styles.queueLeft}>
                    <MaterialIcons name="pets" size={16} color={C.soft} />
                    <Text style={styles.queueText} numberOfLines={1}>
                      Report • {entry.draft.description}
                    </Text>
                  </View>
                  <Text style={styles.queueMeta}>Saved {timeAgo(entry.saved_at)}</Text>
                </View>
                <View style={styles.queueRow}>
                  <View style={styles.queueLeft}>
                    <MaterialIcons name="location-on" size={16} color={C.soft} />
                    <Text style={styles.queueText} numberOfLines={1}>
                      Geo-tag: {entry.draft.address || "Pinned location"}
                    </Text>
                  </View>
                  <Text style={styles.queueMeta}>Queued</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.distress}>
          <View style={styles.distressRow}>
            <View style={styles.distressIcon}>
              <MaterialIcons name="phone-in-talk" size={22} color={colors.onPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.distressTitle}>Critical Animal Distress?</Text>
              <Text style={styles.distressText}>
                {contact ? (
                  <>
                    Don&apos;t wait for sync. Call {contact.name} directly at{" "}
                    <Text style={styles.distressPhone} onPress={call}>
                      {contact.phone}
                    </Text>
                    . Rescue teams in {contact.city || "your area"} can help right away.
                  </>
                ) : (
                  "Don't wait for sync. Call a local rescue team directly. Their numbers are saved here once you've opened StrayAid online."
                )}
              </Text>
              {contact && (
                <View style={styles.distressBottom}>
                  <View style={styles.activeRow}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeText}>Saved on this phone</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`} onPress={call} style={styles.callNow}>
                    <MaterialIcons name="call" size={16} color={C.tertiaryContainer} />
                    <Text style={styles.callNowText}>Call Now</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248,249,255,0.9)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  scroll: { padding: 16, paddingBottom: 32 },
  sync: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: C.low,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  syncLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  syncTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  syncText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  fieldPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.highest },
  fieldDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.tertiary },
  fieldText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.tertiary },
  hero: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 },
  heroOuter: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.tertiaryFixed, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.errorContainer, alignItems: "center", justifyContent: "center" },
  heroBadge: {
    position: "absolute",
    right: -4,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  heading: { marginBottom: 4, fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.4, color: C.ink, textAlign: "center" },
  body: { maxWidth: 320, marginBottom: 16, fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: C.soft, textAlign: "center" },
  diagnostic: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.container, marginBottom: 20 },
  diagnosticText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  message: { marginBottom: 12, fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.green, textAlign: "center" },
  retry: {
    width: "100%",
    height: 48,
    borderRadius: 999,
    backgroundColor: C.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  offline: { width: "100%", height: 48, borderRadius: 999, backgroundColor: C.mint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  offlineText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.onMint },
  queue: {
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  queueHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  queueTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  queueTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  pending: {
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    color: C.onMint,
  },
  queueEmpty: { fontFamily: fonts.body, fontSize: 12, color: C.soft },
  queueItem: { gap: 4 },
  queueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 4, borderRadius: 8, backgroundColor: C.low },
  queueLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  queueText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.ink },
  queueMeta: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  distress: { padding: 12, borderRadius: 12, backgroundColor: C.tertiaryContainer },
  distressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  distressIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tertiary, alignItems: "center", justifyContent: "center" },
  distressTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: colors.onPrimary },
  distressText: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: C.onTertiaryContainer },
  distressPhone: { fontFamily: fonts.bodyBold, color: colors.onPrimary, textDecorationLine: "underline" },
  distressBottom: { marginTop: 8, paddingTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.fixed },
  activeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.onTertiaryContainer },
  callNow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  callNowText: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: C.tertiaryContainer },
});
