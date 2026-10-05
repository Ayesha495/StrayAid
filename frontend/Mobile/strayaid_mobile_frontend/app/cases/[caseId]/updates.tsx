import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CaseSubHeader from "../../../components/case/CaseSubHeader";
import { CaseUpdate, getCaseUpdates, getUpdatesSeenAt, markUpdatesSeen } from "../../../services/caseService";
import { colors, fonts } from "../../../theme/tokens";
import { timeAgo } from "../../../utils/format";

// "Case Updates" from the case page (Stitch 10): the case's history, newest first.
// Status changes are recorded automatically; organizations can add notes.

const ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  reported: "campaign",
  assigned: "how-to-reg",
  in_progress: "directions-run",
  rescued: "favorite",
  adoption: "home",
  closed: "check-circle",
};

// Timeline wording: events rather than the public status names ("Awaiting Responder").
const EVENT_LABELS: Record<string, string> = {
  reported: "Reported",
  assigned: "Organization assigned",
  in_progress: "Rescue in progress",
  rescued: "Rescued",
  adoption: "Up for adoption",
  closed: "Case closed",
};

export default function CaseUpdatesScreen() {
  const { caseId, reference } = useLocalSearchParams<{ caseId: string; reference?: string }>();
  const [updates, setUpdates] = useState<CaseUpdate[] | null>(null);
  const [seenAt, setSeenAt] = useState(Number.POSITIVE_INFINITY);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setUpdates(await getCaseUpdates(caseId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the updates.");
    }
  }, [caseId]);

  useEffect(() => {
    // Read the previous visit first so this visit can still highlight what's new.
    getUpdatesSeenAt(Number(caseId)).then((previous) => {
      setSeenAt(previous);
      markUpdatesSeen(Number(caseId));
    });
    load();
  }, [caseId, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <CaseSubHeader title="Case Updates" subtitle={reference ? `Case #${reference}` : undefined} />

      {!updates ? (
        <View style={styles.centered}>
          {error ? <Text style={styles.empty}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <FlatList
          data={updates}
          keyExtractor={(update) => String(update.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No updates yet.</Text>}
          renderItem={({ item, index }) => {
            const isNew = new Date(item.created_at).getTime() > seenAt;
            const isLast = index === updates.length - 1;
            return (
              <View style={styles.entry}>
                <View style={styles.rail}>
                  <View style={[styles.marker, !item.status && styles.noteMarker]}>
                    <MaterialIcons
                      name={item.status ? ICONS[item.status] ?? "update" : "chat-bubble-outline"}
                      size={14}
                      color={item.status ? colors.onPrimary : colors.primary}
                    />
                  </View>
                  {!isLast && <View style={styles.line} />}
                </View>
                <View style={[styles.card, isLast && styles.cardLast]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.label}>{item.status ? EVENT_LABELS[item.status] ?? item.status_label : "Note from the rescue team"}</Text>
                    {isNew && <Text style={styles.newBadge}>New</Text>}
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.meta}>
                    {[item.author_name, timeAgo(item.created_at)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 20 },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 24 },
  entry: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 28 },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  noteMarker: { backgroundColor: colors.mint },
  line: { flex: 1, width: 2, marginVertical: 4, backgroundColor: "#E2E8F0" },
  card: {
    flex: 1,
    marginBottom: 16,
    padding: 12,
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECE9",
    backgroundColor: "#F8FAF9",
  },
  cardLast: { marginBottom: 0 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: "#243447" },
  newBadge: {
    overflow: "hidden",
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 14,
    color: colors.primary,
  },
  message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#475569" },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, color: "#94A3B8" },
});
