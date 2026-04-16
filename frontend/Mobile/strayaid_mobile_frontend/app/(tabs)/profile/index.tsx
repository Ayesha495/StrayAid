import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getCurrentUser, getMyReports, logoutUser } from "../../../services/authService";
import type { CurrentUser } from "../../../types/auth";

type ReportCase = {
  id: number;
  status: string;
  description: string;
  created_at: string;
};

const palette = {
  white: "#ffffff",
  cream: "#f7faf9",
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

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [reports, setReports] = useState<ReportCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      Promise.all([getCurrentUser(), getMyReports()])
        .then(([currentUser, myReports]) => {
          setUser(currentUser);
          setReports(myReports);
        })
        .catch(() => {
          setUser(null);
          setReports([]);
        })
        .finally(() => setIsLoading(false));
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Profile</Text>
          <Text style={styles.title}>Your account and reporting access.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.username?.[0] || "S").toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.username || "StrayAid User"}</Text>
          <Text style={styles.email}>{user?.email || "Signed in account"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role === "organization" ? "Organization Access" : "Public Access"}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What you can do here</Text>
          <Text style={styles.infoText}>Create reports, review your submitted cases, and keep your account session secure.</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>My Reports</Text>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={palette.teal} />
            </View>
          ) : reports.length === 0 ? (
            <Text style={styles.infoText}>No reports submitted yet.</Text>
          ) : (
            <View style={styles.reportList}>
              {reports.map((report) => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Case #{report.id}</Text>
                    <Text style={styles.reportStatus}>{statusLabel[report.status] ?? report.status}</Text>
                  </View>
                  <Text style={styles.reportDescription}>{report.description || "No description provided."}</Text>
                  <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.logoutButton} onPress={logoutUser}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.white,
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
  profileCard: {
    backgroundColor: palette.cream,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
  },
  name: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  email: {
    color: palette.muted,
    fontSize: 15,
  },
  roleBadge: {
    marginTop: 6,
    backgroundColor: "#fff4df",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleText: {
    color: palette.amber,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: palette.cream,
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  loadingRow: {
    paddingVertical: 12,
    alignItems: "center",
  },
  infoTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  infoText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  reportList: {
    gap: 12,
    marginTop: 4,
  },
  reportCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  reportTitle: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  reportStatus: {
    color: palette.teal,
    fontWeight: "700",
    fontSize: 12,
  },
  reportDescription: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  reportDate: {
    color: palette.muted,
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: palette.teal,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
