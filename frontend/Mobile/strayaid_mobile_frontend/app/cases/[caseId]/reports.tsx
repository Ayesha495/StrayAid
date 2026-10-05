import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CaseSubHeader from "../../../components/case/CaseSubHeader";
import { CaseReport, getCaseReports } from "../../../services/caseService";
import type { Severity } from "../../../services/reportDraft";
import { colors, fonts } from "../../../theme/tokens";
import { timeAgo } from "../../../utils/format";

// "Related Reports" from the case page (Stitch 10): every sighting that rolled up into this
// case. Reporters appear by first name only.

const SEVERITY: Record<Severity, { label: string; color: string; background: string }> = {
  low: { label: "Low", color: "#1E8A66", background: "#E8F7F2" },
  medium: { label: "Medium", color: "#B7791F", background: "#FEF7ED" },
  high: { label: "High", color: colors.critical, background: "#FDEEEC" },
  critical: { label: "Critical", color: "#B42318", background: "#FDECEC" },
};

export default function CaseReportsScreen() {
  const { caseId, reference } = useLocalSearchParams<{ caseId: string; reference?: string }>();
  const [reports, setReports] = useState<CaseReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await getCaseReports(caseId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the reports.");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <CaseSubHeader
        title="Related Reports"
        subtitle={reports ? `${reports.length} ${reports.length === 1 ? "report" : "reports"}${reference ? ` · Case #${reference}` : ""}` : undefined}
      />

      {!reports ? (
        <View style={styles.centered}>
          {error ? <Text style={styles.empty}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(report) => String(report.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            reports.length > 1 ? (
              <Text style={styles.intro}>
                Reports made close together are combined into one case so rescuers see every sighting.
              </Text>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No reports yet.</Text>}
          renderItem={({ item }) => {
            const severity = SEVERITY[item.severity] ?? SEVERITY.medium;
            return (
              <View style={styles.card}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.photo} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]}>
                    <MaterialIcons name="pets" size={32} color="#CBD5E1" />
                  </View>
                )}
                <View style={styles.body}>
                  <View style={styles.row}>
                    <Text style={styles.reporter}>
                      {item.is_mine ? "Your report" : item.reporter}
                      <Text style={styles.time}> · {timeAgo(item.created_at)}</Text>
                    </Text>
                    <Text style={[styles.severity, { color: severity.color, backgroundColor: severity.background }]}>
                      {severity.label}
                    </Text>
                  </View>
                  {!!item.description && <Text style={styles.description}>{item.description}</Text>}
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
  list: { padding: 20, gap: 16 },
  intro: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: "#747474" },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 24 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8ECE9",
    backgroundColor: colors.surface,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  photo: { height: 170, backgroundColor: "#E2E8F0" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reporter: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: "#243447" },
  time: { fontFamily: fonts.bodyMedium, color: "#94A3B8" },
  severity: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
  },
  description: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#475569" },
});
