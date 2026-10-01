import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../../../styles/mobileTheme";
import {
  getCurrentUser,
  getMyOrganizationProfile,
  getMyReports,
  getMyFollows,
  type MobileCase,
  type MobileOrganization,
  type MobileUser,
} from "../../../services/mobileContentService";
import { logoutUser } from "../../../services/authService";

const STATUS_COLORS: Record<string, string> = {
  reported: "#f59e0b",
  assigned: "#3b82f6",
  in_progress: "#8b5cf6",
  rescued: "#10b981",
  closed: "#6b7280",
  adoption: "#ec4899",
};

export default function ProfilePage() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [organization, setOrganization] = useState<MobileOrganization | null>(null);
  const [reports, setReports] = useState<MobileCase[]>([]);
  const [followCounts, setFollowCounts] = useState({ animals: 0, orgs: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);

    const [reportData, followData] = await Promise.all([
      getMyReports(),
      getMyFollows(),
    ]);
    setReports(reportData);
    setFollowCounts({ animals: followData.followed_animals.length, orgs: followData.followed_organizations.length });

    if (currentUser.role === "organization") {
      getMyOrganizationProfile().then(setOrganization).catch(console.error);
    }
  };

  useEffect(() => { load().catch(console.error); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const displayName = user?.role === "organization"
    ? (organization?.name || "Organization")
    : (user?.username || user?.first_name || "User");

  const initials = (displayName || user?.email || "U").slice(0, 2).toUpperCase();

  const activeReports = reports.filter((r) => !["closed", "adoption"].includes(r.status)).length;

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => logoutUser() },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.pageTitle}>Profile</Text>
          <Pressable style={s.settingsBtn} onPress={handleLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={theme.colors.inkMuted} />
          </Pressable>
        </View>

        {/* Avatar + name */}
        <View style={s.profileSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.displayName}>{displayName}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{user?.role === "organization" ? "Rescue Organization" : "Community Reporter"}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{reports.length}</Text>
            <Text style={s.statLabel}>Reports</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{activeReports}</Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{followCounts.animals}</Text>
            <Text style={s.statLabel}>Animals</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{followCounts.orgs}</Text>
            <Text style={s.statLabel}>Orgs</Text>
          </View>
        </View>

        {/* My Reports */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>My Reports</Text>
            <Text style={s.cardCount}>{reports.length} total</Text>
          </View>
          {reports.length ? reports.map((c) => (
            <View key={c.id} style={s.reportItem}>
              <View style={s.reportLeft}>
                <Text style={s.reportId}>Case #{c.id}</Text>
                <Text style={s.reportDate}>{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[c.status] ?? theme.colors.primary) + "18" }]}>
                <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[c.status] ?? theme.colors.primary }]} />
                <Text style={[s.statusText, { color: STATUS_COLORS[c.status] ?? theme.colors.primary }]}>
                  {c.status.replace("_", " ")}
                </Text>
              </View>
            </View>
          )) : (
            <View style={s.emptyInCard}>
              <Ionicons name="document-text-outline" size={28} color={theme.colors.inkMuted} />
              <Text style={s.emptyText}>No reports yet. Use the camera tab to report a stray.</Text>
            </View>
          )}
        </View>

        {/* Account section */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Account</Text>
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={16} color={theme.colors.inkMuted} />
            <View>
              <Text style={s.infoLabel}>Username</Text>
              <Text style={s.infoValue}>{user?.username || "—"}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="mail-outline" size={16} color={theme.colors.inkMuted} />
            <View>
              <Text style={s.infoLabel}>Email</Text>
              <Text style={s.infoValue}>{user?.email || "—"}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.inkMuted} />
            <View>
              <Text style={s.infoLabel}>Role</Text>
              <Text style={s.infoValue}>{user?.role === "organization" ? "Organization" : "Public User"}</Text>
            </View>
          </View>
        </View>

        {/* Log out */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
          <Text style={s.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scroll: { paddingBottom: 120, gap: theme.spacing.md },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  pageTitle: { fontSize: 28, fontWeight: "800", color: theme.colors.ink },
  settingsBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  profileSection: { alignItems: "center", paddingVertical: theme.spacing.lg, gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.primaryDeep, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "900" },
  displayName: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
  email: { fontSize: 14, color: theme.colors.inkMuted },
  roleBadge: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },

  statsRow: { flexDirection: "row", backgroundColor: theme.colors.surface, marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.lg, padding: theme.spacing.lg, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, backgroundColor: theme.colors.border },
  statNum: { fontSize: 20, fontWeight: "900", color: theme.colors.ink },
  statLabel: { fontSize: 10, fontWeight: "600", color: theme.colors.inkMuted, textTransform: "uppercase" },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.lg, padding: theme.spacing.lg, gap: theme.spacing.md, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  cardCount: { fontSize: 13, color: theme.colors.inkMuted },

  reportItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  reportLeft: { gap: 2 },
  reportId: { fontSize: 14, fontWeight: "700", color: theme.colors.ink },
  reportDate: { fontSize: 12, color: theme.colors.inkMuted },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  emptyInCard: { alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  emptyText: { fontSize: 13, color: theme.colors.inkMuted, textAlign: "center", lineHeight: 18 },

  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.colors.border },
  infoLabel: { fontSize: 11, fontWeight: "600", color: theme.colors.inkMuted, textTransform: "uppercase" },
  infoValue: { fontSize: 14, color: theme.colors.inkSoft },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: theme.spacing.lg, paddingVertical: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.danger + "40", backgroundColor: theme.colors.danger + "08" },
  logoutText: { fontSize: 15, fontWeight: "700", color: theme.colors.danger },
});
