import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../../../styles/mobileTheme";
import {
  getMyFollows,
  getMyReports,
  getAnimal,
  getOrganization,
  type MobileAnimal,
  type MobileCase,
  type MobileOrganization,
} from "../../../services/mobileContentService";

const STATUS_COLORS: Record<string, string> = {
  reported: "#f59e0b",
  assigned: "#3b82f6",
  in_progress: "#8b5cf6",
  rescued: "#10b981",
  closed: "#6b7280",
  adoption: "#ec4899",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? theme.colors.primary;
  return (
    <View style={[s.badge, { backgroundColor: color + "20" }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>{status.replace("_", " ")}</Text>
    </View>
  );
}

export default function ActivityPage() {
  const [reports, setReports] = useState<MobileCase[]>([]);
  const [followedAnimals, setFollowedAnimals] = useState<MobileAnimal[]>([]);
  const [followedOrgs, setFollowedOrgs] = useState<MobileOrganization[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [reportData, followData] = await Promise.all([
      getMyReports().catch(() => [] as MobileCase[]),
      getMyFollows().catch(() => ({ followed_animals: [] as number[], followed_organizations: [] as number[] })),
    ]);
    setReports(reportData);

    const [animals, orgs] = await Promise.all([
      Promise.all(followData.followed_animals.map((id) => getAnimal(id).catch(() => null))),
      Promise.all(followData.followed_organizations.map((id) => getOrganization(id).catch(() => null))),
    ]);
    setFollowedAnimals(animals.filter(Boolean) as MobileAnimal[]);
    setFollowedOrgs(orgs.filter(Boolean) as MobileOrganization[]);
  };

  useEffect(() => { load().catch(console.error); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={s.header}>
          <Text style={s.pageTitle}>Activity</Text>
        </View>

        {/* My Reports */}
        <Text style={s.sectionTitle}>My Reports</Text>
        <Text style={s.sectionSub}>Track the status of cases you reported.</Text>
        {reports.length ? reports.map((c) => (
          <View key={c.id} style={s.reportCard}>
            <View style={s.reportRow}>
              <View style={s.reportIconWrap}>
                <Ionicons name="location" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.reportTitle}>Case #{c.id}</Text>
                <Text style={s.reportMeta}>{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
              </View>
              <StatusBadge status={c.status} />
            </View>
            {c.description ? (
              <Text style={s.reportDesc} numberOfLines={2}>{c.description}</Text>
            ) : null}
          </View>
        )) : (
          <View style={s.emptyBox}>
            <Ionicons name="document-text-outline" size={32} color={theme.colors.inkMuted} />
            <Text style={s.emptyText}>No reports yet. Use the camera tab to report a stray animal.</Text>
          </View>
        )}

        {/* Followed Animals */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Following · Animals</Text>
        <Text style={s.sectionSub}>Get notified when their status changes.</Text>
        {followedAnimals.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
            {followedAnimals.map((a) => (
              <Pressable key={a.id} style={s.animalChip} onPress={() => router.push(`/animals/${a.id}`)}>
                <View style={s.animalChipImg}>
                  {a.image
                    ? <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} />
                    : <Ionicons name="paw" size={22} color={theme.colors.primary} />
                  }
                </View>
                <Text style={s.animalChipName} numberOfLines={1}>{a.name}</Text>
                <View style={[s.animalChipBadge, { backgroundColor: (STATUS_COLORS[a.status] ?? theme.colors.primary) + "20" }]}>
                  <Text style={[s.animalChipStatus, { color: STATUS_COLORS[a.status] ?? theme.colors.primary }]}>{a.status}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={s.emptyBox}>
            <Ionicons name="heart-outline" size={32} color={theme.colors.inkMuted} />
            <Text style={s.emptyText}>Tap the bell icon on any animal to follow it.</Text>
          </View>
        )}

        {/* Followed Organizations */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Following · Organizations</Text>
        <Text style={s.sectionSub}>See their new posts and animals.</Text>
        {followedOrgs.length ? followedOrgs.map((org) => (
          <Pressable key={org.id} style={s.orgCard} onPress={() => router.push(`/organizations/${org.id}`)}>
            <View style={s.orgAvatar}>
              {org.image
                ? <Image source={{ uri: org.image }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
                : <Ionicons name="business" size={20} color={theme.colors.primary} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.orgName}>{org.name}</Text>
              <Text style={s.orgMeta}>{org.city || org.address || "Rescue organization"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.inkMuted} />
          </Pressable>
        )) : (
          <View style={s.emptyBox}>
            <Ionicons name="business-outline" size={32} color={theme.colors.inkMuted} />
            <Text style={s.emptyText}>Follow an organization from its profile to see updates here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: theme.colors.ink },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink },
  sectionSub: { fontSize: 13, color: theme.colors.inkMuted, marginBottom: 4 },

  // Report cards
  reportCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  reportRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  reportIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  reportMeta: { fontSize: 12, color: theme.colors.inkMuted },
  reportDesc: { fontSize: 13, color: theme.colors.inkSoft, lineHeight: 18 },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  // Empty state
  emptyBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm },
  emptyText: { color: theme.colors.inkMuted, textAlign: "center", lineHeight: 20, fontSize: 13 },

  // Animal horizontal chips
  hScroll: { gap: theme.spacing.sm, paddingVertical: 4 },
  animalChip: { width: 110, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.sm, alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  animalChipImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primarySoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  animalChipName: { fontSize: 12, fontWeight: "700", color: theme.colors.ink, textAlign: "center" },
  animalChipBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  animalChipStatus: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },

  // Org cards
  orgCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  orgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primarySoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  orgName: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  orgMeta: { fontSize: 12, color: theme.colors.inkMuted },
});
