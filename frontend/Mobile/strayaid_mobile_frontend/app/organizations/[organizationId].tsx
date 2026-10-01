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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../../styles/mobileTheme";
import {
  getOrganization,
  getOrganizationAnimals,
  type MobileAnimal,
  type MobileOrganization,
} from "../../services/mobileContentService";
import {
  followOrganization,
  unfollowOrganization,
  getFollowStatus,
} from "../../services/notificationService";

const STATUS_COLORS: Record<string, string> = {
  rescued: "#10b981",
  recovering: "#f59e0b",
  adoptable: "#ec4899",
  adopted: "#6b7280",
};

export default function OrganizationProfilePage() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const [organization, setOrganization] = useState<MobileOrganization | null>(null);
  const [animals, setAnimals] = useState<MobileAnimal[]>([]);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!organizationId) return;
    const [orgData, animalData, followData] = await Promise.all([
      getOrganization(organizationId),
      getOrganizationAnimals(organizationId),
      getFollowStatus({ orgId: Number(organizationId) }),
    ]);
    setOrganization(orgData);
    setAnimals(animalData);
    if (followData.followingOrg !== undefined) setFollowing(followData.followingOrg);
  };

  useEffect(() => { load().catch(console.error); }, [organizationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const toggleFollow = async () => {
    if (!organizationId) return;
    const next = following
      ? await unfollowOrganization(Number(organizationId))
      : await followOrganization(Number(organizationId));
    setFollowing(next);
  };

  const infoItems = [
    { icon: "mail-outline" as const, label: "Email", value: organization?.contact_email || organization?.user_email },
    { icon: "call-outline" as const, label: "Phone", value: organization?.phone_number },
    { icon: "location-outline" as const, label: "Location", value: [organization?.address, organization?.city].filter(Boolean).join(", ") || null },
  ].filter((i) => i.value);

  const donationLines = [
    organization?.bank_account_title ? `Account Title: ${organization.bank_account_title}` : null,
    organization?.bank_account_number ? `Account / Wallet: ${organization.bank_account_number}` : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.topBar}>
          <Pressable style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
          </Pressable>
          <Text style={s.pageTitle}>Organization</Text>
          <Pressable style={[s.iconBtn, following && s.iconBtnActive]} onPress={toggleFollow}>
            <Ionicons
              name={following ? "notifications" : "notifications-outline"}
              size={22}
              color={following ? theme.colors.primary : theme.colors.ink}
            />
          </Pressable>
        </View>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileImageWrap}>
            {organization?.image ? (
              <Image source={{ uri: organization.image }} style={StyleSheet.absoluteFill} />
            ) : (
              <Ionicons name="business" size={40} color={theme.colors.primary} />
            )}
          </View>
          <Text style={s.orgName}>{organization?.name || "Loading..."}</Text>
          {organization?.city ? (
            <View style={s.locationRow}>
              <Ionicons name="location" size={13} color={theme.colors.inkMuted} />
              <Text style={s.locationText}>{organization.city}</Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{animals.length}</Text>
              <Text style={s.statLabel}>Animals</Text>
            </View>
            {organization?.capacity ? (
              <View style={s.statItem}>
                <Text style={s.statNum}>{organization.capacity}</Text>
                <Text style={s.statLabel}>Capacity</Text>
              </View>
            ) : null}
            {organization?.radius ? (
              <View style={s.statItem}>
                <Text style={s.statNum}>{organization.radius} km</Text>
                <Text style={s.statLabel}>Service Radius</Text>
              </View>
            ) : null}
          </View>

          {/* Follow button */}
          <Pressable style={[s.followButton, following && s.followButtonActive]} onPress={toggleFollow}>
            <Ionicons name={following ? "notifications" : "notifications-outline"} size={16} color={following ? theme.colors.primary : "#fff"} />
            <Text style={[s.followButtonText, following && s.followButtonTextActive]}>
              {following ? "Following" : "Follow Updates"}
            </Text>
          </Pressable>
        </View>

        {/* Contact info */}
        {infoItems.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Contact</Text>
            {infoItems.map((item) => (
              <View key={item.label} style={s.infoRow}>
                <View style={s.infoIconWrap}>
                  <Ionicons name={item.icon} size={16} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Animals in care */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Animals In Their Care</Text>
          {animals.length ? animals.map((animal) => (
            <Pressable key={animal.id} style={s.animalRow} onPress={() => router.push(`/animals/${animal.id}`)}>
              <View style={s.animalThumb}>
                {animal.image
                  ? <Image source={{ uri: animal.image }} style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.sm }]} />
                  : <Ionicons name="paw" size={20} color={theme.colors.primary} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.animalName}>{animal.name}</Text>
                {animal.description ? (
                  <Text style={s.animalDesc} numberOfLines={1}>{animal.description}</Text>
                ) : null}
              </View>
              <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[animal.status] ?? theme.colors.primary) + "18" }]}>
                <Text style={[s.statusText, { color: STATUS_COLORS[animal.status] ?? theme.colors.primary }]}>{animal.status}</Text>
              </View>
            </Pressable>
          )) : (
            <Text style={s.emptyText}>No animal profiles available yet.</Text>
          )}
        </View>

        {/* Donation info */}
        {donationLines.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Donation Information</Text>
            {donationLines.map((line) => (
              <View key={line} style={s.donationLine}>
                <Ionicons name="card-outline" size={16} color={theme.colors.primary} />
                <Text style={s.donationText}>{line}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scroll: { paddingBottom: 48, gap: theme.spacing.md },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconBtnActive: { backgroundColor: theme.colors.primarySoft },
  pageTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.ink },

  profileCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.md, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  profileImageWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: theme.colors.primarySoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  orgName: { fontSize: 24, fontWeight: "900", color: theme.colors.ink, textAlign: "center" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 13, color: theme.colors.inkMuted },

  statsRow: { flexDirection: "row", gap: theme.spacing.xl, justifyContent: "center" },
  statItem: { alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: "900", color: theme.colors.ink },
  statLabel: { fontSize: 11, color: theme.colors.inkMuted, textTransform: "uppercase", fontWeight: "600" },

  followButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingHorizontal: 24, paddingVertical: 12, width: "100%", justifyContent: "center" },
  followButtonActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary },
  followButtonText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  followButtonTextActive: { color: theme.colors.primary },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.lg, padding: theme.spacing.lg, gap: theme.spacing.md, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },

  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  infoIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", marginTop: 2 },
  infoLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, color: theme.colors.inkSoft },

  animalRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  animalThumb: { width: 52, height: 52, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primarySoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  animalName: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  animalDesc: { fontSize: 12, color: theme.colors.inkMuted },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  emptyText: { fontSize: 14, color: theme.colors.inkMuted },

  donationLine: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  donationText: { fontSize: 14, color: theme.colors.inkSoft, flex: 1 },
});
