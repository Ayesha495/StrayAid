import { useEffect, useState } from "react";
import {
  Image,
  Modal,
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
  getAnimal,
  getAnimalPosts,
  type MobileAnimal,
  type MobilePost,
} from "../../services/mobileContentService";
import {
  followAnimal,
  unfollowAnimal,
  getFollowStatus,
} from "../../services/notificationService";

const STATUS_COLORS: Record<string, string> = {
  rescued: "#10b981",
  recovering: "#f59e0b",
  adoptable: "#ec4899",
  adopted: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  rescued: "Rescued",
  recovering: "Recovering",
  adoptable: "Ready for Adoption",
  adopted: "Adopted",
};

export default function AnimalDetailPage() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const [animal, setAnimal] = useState<MobileAnimal | null>(null);
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [showDonate, setShowDonate] = useState(false);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!animalId) return;
    const [animalData, postData, followData] = await Promise.all([
      getAnimal(animalId),
      getAnimalPosts(animalId),
      getFollowStatus({ animalId: Number(animalId) }),
    ]);
    setAnimal(animalData);
    setPosts(postData);
    if (followData.followingAnimal !== undefined) setFollowing(followData.followingAnimal);
  };

  useEffect(() => { load().catch(console.error); }, [animalId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const toggleFollow = async () => {
    if (!animal) return;
    const next = following
      ? await unfollowAnimal(animal.id)
      : await followAnimal(animal.id);
    setFollowing(next);
  };

  const color = animal ? (STATUS_COLORS[animal.status] ?? theme.colors.primary) : theme.colors.primary;

  const statChips = [
    animal?.species && { label: "Species", value: animal.species },
    animal?.breed && { label: "Breed", value: animal.breed },
    animal?.gender && { label: "Gender", value: animal.gender },
    animal?.age != null && { label: "Age", value: `${animal.age} yr${animal.age !== 1 ? "s" : ""}` },
    animal?.color && { label: "Color", value: animal.color },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image with overlaid back button + follow button */}
        <View style={s.heroWrap}>
          {animal?.image ? (
            <Image source={{ uri: animal.image }} style={s.heroImage} />
          ) : (
            <View style={[s.heroImage, s.heroPlaceholder]}>
              <Ionicons name="paw" size={60} color={theme.colors.primary} />
            </View>
          )}
          <View style={s.heroOverlay}>
            <Pressable style={s.iconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
            </Pressable>
            <Pressable
              style={[s.iconBtn, following && s.iconBtnActive]}
              onPress={toggleFollow}
            >
              <Ionicons
                name={following ? "notifications" : "notifications-outline"}
                size={22}
                color={following ? theme.colors.primary : theme.colors.ink}
              />
            </Pressable>
          </View>
        </View>

        {/* Status + Name */}
        <View style={s.nameSection}>
          <View style={[s.statusPill, { backgroundColor: color + "18" }]}>
            <View style={[s.statusDot, { backgroundColor: color }]} />
            <Text style={[s.statusText, { color }]}>{STATUS_LABELS[animal?.status ?? ""] ?? animal?.status}</Text>
          </View>
          <Text style={s.animalName}>{animal?.name || "Loading..."}</Text>
          {animal?.organization ? (
            <Pressable onPress={() => router.push(`/organizations/${animal.organization.id}`)}>
              <View style={s.orgRow}>
                <Ionicons name="business-outline" size={14} color={theme.colors.primary} />
                <Text style={s.orgName}>{animal.organization.name}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Stats chips */}
        {statChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow}>
            {statChips.map((chip) => (
              <View key={chip.label} style={s.statChip}>
                <Text style={s.statLabel}>{chip.label}</Text>
                <Text style={s.statValue}>{chip.value}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Description */}
        {animal?.description ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>About</Text>
            <Text style={s.cardBody}>{animal.description}</Text>
          </View>
        ) : null}

        {/* Medical info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Care & Medical Notes</Text>
          <Text style={s.cardBody}>
            {animal?.medical_info || "No medical or recovery notes have been shared yet."}
          </Text>
        </View>

        {/* Donation CTA */}
        {animal?.donation_info ? (
          <Pressable style={s.donateCta} onPress={() => setShowDonate(true)}>
            <Ionicons name="heart" size={20} color="#fff" />
            <Text style={s.donateCtaText}>View Donation Information</Text>
          </Pressable>
        ) : null}

        {/* Updates */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Updates from {animal?.organization?.name}</Text>
          {posts.length ? posts.map((post) => (
            <View key={post.id} style={s.updateCard}>
              {post.image ? <Image source={{ uri: post.image }} style={s.updateImage} /> : null}
              <Text style={s.updateTitle}>{post.title}</Text>
              <Text style={s.updateDate}>{new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
              <Text style={s.cardBody}>{post.content}</Text>
            </View>
          )) : (
            <Text style={s.cardBody}>No updates have been posted yet.</Text>
          )}
        </View>
      </ScrollView>

      {/* Donation modal */}
      <Modal visible={showDonate} transparent animationType="fade" onRequestClose={() => setShowDonate(false)}>
        <Pressable style={s.modalBg} onPress={() => setShowDonate(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalEyebrow}>Donation Information</Text>
            <Text style={s.modalTitle}>{animal?.name}</Text>
            <Text style={s.modalBody}>{animal?.donation_info}</Text>
            <Pressable style={s.modalCloseBtn} onPress={() => setShowDonate(false)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scroll: { paddingBottom: 48, gap: theme.spacing.md },

  // Hero
  heroWrap: { position: "relative" },
  heroImage: { width: "100%", height: 320 },
  heroPlaceholder: { backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", padding: theme.spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  iconBtnActive: { backgroundColor: theme.colors.primarySoft },

  // Name section
  nameSection: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, gap: 6 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  animalName: { fontSize: 30, fontWeight: "900", color: theme.colors.ink, letterSpacing: -0.5 },
  orgRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  orgName: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },

  // Stats chips
  statsRow: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  statChip: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 10, alignItems: "center", minWidth: 80, gap: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statLabel: { fontSize: 10, fontWeight: "600", color: theme.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: "800", color: theme.colors.ink },

  // Cards
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginHorizontal: theme.spacing.lg, gap: theme.spacing.sm, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  cardBody: { fontSize: 14, color: theme.colors.inkSoft, lineHeight: 22 },

  // Donate CTA
  donateCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.lg, paddingVertical: 16 },
  donateCtaText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Update cards within card
  updateCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: 6, backgroundColor: theme.colors.surfaceMuted },
  updateImage: { width: "100%", height: 180, borderRadius: theme.radius.sm },
  updateTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
  updateDate: { fontSize: 12, color: theme.colors.inkMuted },

  // Donation modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, gap: theme.spacing.md, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 4 },
  modalEyebrow: { fontSize: 11, fontWeight: "700", color: theme.colors.inkMuted, textTransform: "uppercase", letterSpacing: 1 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
  modalBody: { fontSize: 15, color: theme.colors.inkSoft, lineHeight: 22 },
  modalCloseBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingVertical: 14, alignItems: "center" },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
