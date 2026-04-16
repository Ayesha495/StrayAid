import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getMyReports } from "../../../services/authService";

type ReportCase = {
  id: number;
  status: string;
  description: string;
  created_at: string;
  reports: Array<{
    id: number;
    image: string;
    created_at: string;
  }>;
};

const palette = {
  sand: "#f5efe4",
  cream: "#fbf8f2",
  teal: "#0f766e",
  amber: "#d97706",
  ink: "#172033",
  muted: "#6e6458",
};

const statusLabel: Record<string, string> = {
  reported: "Reported",
  assigned: "Accepted",
  in_progress: "In Progress",
  rescued: "Rescued",
  adoption: "Up For Adoption",
  closed: "Closed",
};

export default function MyReportsPage() {
  const [reports, setReports] = useState<ReportCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    const result = await getMyReports();
    setReports(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadReports()
        .catch(() => setReports([]))
        .finally(() => setIsLoading(false));
    }, [loadReports])
  );

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadReports();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.teal} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>My Reports</Text>
          <Text style={styles.title}>Track the reports you’ve submitted.</Text>
          <Text style={styles.subtitle}>
            Each card shows the case status so you can see whether a rescue has been accepted or resolved.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={palette.teal} />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>Your submitted cases will appear here after your first report.</Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportId}>Case #{report.id}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{statusLabel[report.status] ?? report.status}</Text>
                </View>
              </View>
              <Text style={styles.reportDescription}>{report.description || "No description provided."}</Text>
              <Text style={styles.reportMeta}>
                Submitted {new Date(report.created_at).toLocaleDateString()} • {report.reports.length} update
                {report.reports.length === 1 ? "" : "s"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.sand,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  hero: {
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
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingCard: {
    backgroundColor: palette.cream,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: palette.cream,
    borderRadius: 24,
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  reportCard: {
    backgroundColor: palette.cream,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  reportId: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "#d9f3ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: palette.teal,
    fontSize: 12,
    fontWeight: "700",
  },
  reportDescription: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  reportMeta: {
    color: palette.muted,
    fontSize: 13,
  },
});
