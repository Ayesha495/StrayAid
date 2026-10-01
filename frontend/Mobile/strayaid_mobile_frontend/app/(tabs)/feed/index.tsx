import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../../../styles/mobileTheme";
import { getPublicAnimals, getPublicFeed, type MobileAnimal, type MobilePost } from "../../../services/mobileContentService";
import { followAnimal, unfollowAnimal, getFollowStatus } from "../../../services/notificationService";

const STATUS_COLORS: Record<string, string> = {
  rescued: "#10b981",
  recovering: "#f59e0b",
  adoptable: "#ec4899",
  adopted: "#6b7280",
};

function FadeInCard({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function AnimalCard({ animal, onFollow }: { animal: MobileAnimal; onFollow: (id: number, following: boolean) => void }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    getFollowStatus({ animalId: animal.id })
      .then((r) => { if (r.followingAnimal !== undefined) setFollowing(r.followingAnimal); })
      .catch(() => null);
  }, [animal.id]);

  const toggleFollow = async () => {
    const next = following ? await unfollowAnimal(animal.id) : await followAnimal(animal.id);
    setFollowing(next);
    onFollow(animal.id, next);
  };

  const color = STATUS_COLORS[animal.status] ?? theme.colors.primary;

  return (
    <Pressable style={s.animalCard} onPress={() => router.push(`/animals/${animal.id}` as Href)}>
      {animal.image ? (
        <Image source={{ uri: animal.image }} style={s.animalImage} />
      ) : (
        <View style={[s.animalImage, s.animalImagePlaceholder]}>
          <Ionicons name="paw" size={36} color={theme.colors.primary} />
        </View>
      )}
      <View style={s.animalCardBody}>
        <View style={s.animalCardTop}>
          <View style={[s.statusPill, { backgroundColor: color + "18" }]}>
            <View style={[s.statusDot, { backgroundColor: color }]} />
            <Text style={[s.statusText, { color }]}>{animal.status}</Text>
          </View>
          <Pressable style={[s.followBtn, following && s.followBtnActive]} onPress={toggleFollow} hitSlop={8}>
            <Ionicons name={following ? "notifications" : "notifications-outline"} size={18} color={following ? theme.colors.primary : theme.colors.inkMuted} />
          </Pressable>
        </View>
        <Text style={s.animalName}>{animal.name}</Text>
        <Pressable onPress={() => router.push(`/organizations/${animal.organization.id}` as Href)}>
          <Text style={s.orgLink}>{animal.organization.name}</Text>
        </Pressable>
        {animal.description ? (
          <Text style={s.cardDesc} numberOfLines={2}>{animal.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PostCard({ post, onSponsor }: { post: MobilePost; onSponsor: (a: MobileAnimal) => void }) {
  const categoryColors: Record<string, string> = {
    medical: "#f59e0b",
    adoption: "#ec4899",
    sponsorship: "#3b82f6",
    foster: "#8b5cf6",
  };
  const catColor = categoryColors[post.category ?? ""] ?? theme.colors.primary;

  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <Pressable style={s.orgChip} onPress={() => router.push(`/organizations/${post.organization.id}` as Href)}>
          <View style={s.orgChipDot} />
          <Text style={s.orgChipText}>{post.organization.name}</Text>
        </Pressable>
        {post.category ? (
          <View style={[s.catBadge, { backgroundColor: catColor + "18" }]}>
            <Text style={[s.catBadgeText, { color: catColor }]}>{post.category}</Text>
          </View>
        ) : null}
      </View>
      {(post.image || post.animal.image) ? (
        <Image source={{ uri: post.image || post.animal.image || "" }} style={s.postImage} />
      ) : null}
      <View style={s.postBody}>
        <Text style={s.postTitle}>{post.title}</Text>
        <View style={s.postMetaRow}>
          <Pressable onPress={() => router.push(`/animals/${post.animal.id}` as Href)}>
            <Text style={s.animalLink}>{post.animal.name}</Text>
          </Pressable>
          <Text style={s.postDate}>{new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
        </View>
        <Text style={s.postContent} numberOfLines={3}>{post.content}</Text>
        <Pressable style={s.donateRow} onPress={() => onSponsor(post.animal)}>
          <Ionicons name="heart-outline" size={14} color={theme.colors.primary} />
          <Text style={s.donateText}>Donation Info</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [animals, setAnimals] = useState<MobileAnimal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sponsorAnimal, setSponsorAnimal] = useState<MobileAnimal | null>(null);

  const load = async () => {
    const [postsData, animalsData] = await Promise.all([getPublicFeed(), getPublicAnimals()]);
    setPosts(postsData);
    setAnimals(animalsData);
  };

  useEffect(() => { load().catch(console.error); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* App header */}
      <View style={s.appBar}>
        <Text style={s.appLogo}>StrayAid</Text>
        <Pressable style={s.appBarBtn} onPress={() => router.push("/(tabs)/activity" as Href)} hitSlop={8}>
          <Ionicons name="notifications-outline" size={24} color={theme.colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Report CTA Banner */}
        <FadeInCard index={0}>
          <Pressable style={s.ctaBanner} onPress={() => router.push("/(tabs)/report" as Href)}>
            <View style={s.ctaIconWrap}>
              <Ionicons name="camera" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ctaTitle}>Spot a stray?</Text>
              <Text style={s.ctaBody}>Tap to report and connect them to rescuers.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </FadeInCard>

        {/* Animals In Care */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Animals In Care</Text>
          <Text style={s.sectionCount}>{animals.length} profiles</Text>
        </View>

        {animals.length ? animals.map((animal, index) => (
          <FadeInCard key={animal.id} index={index + 1}>
            <AnimalCard animal={animal} onFollow={() => null} />
          </FadeInCard>
        )) : (
          <View style={s.emptyBox}>
            <Ionicons name="paw-outline" size={32} color={theme.colors.inkMuted} />
            <Text style={s.emptyText}>No animal profiles yet.</Text>
          </View>
        )}

        {/* Latest Updates */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Latest Updates</Text>
          <Text style={s.sectionCount}>{posts.length} posts</Text>
        </View>

        {posts.length ? posts.map((post, index) => (
          <FadeInCard key={post.id} index={index + animals.length + 1}>
            <PostCard post={post} onSponsor={setSponsorAnimal} />
          </FadeInCard>
        )) : (
          <View style={s.emptyBox}>
            <Ionicons name="newspaper-outline" size={32} color={theme.colors.inkMuted} />
            <Text style={s.emptyText}>No organization updates yet.</Text>
          </View>
        )}
      </ScrollView>

      {/* Donation modal */}
      <Modal visible={Boolean(sponsorAnimal)} transparent animationType="fade" onRequestClose={() => setSponsorAnimal(null)}>
        <Pressable style={s.modalBg} onPress={() => setSponsorAnimal(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalEyebrow}>Donation Information</Text>
            <Text style={s.modalTitle}>{sponsorAnimal?.name}</Text>
            <Text style={s.modalBody}>
              {sponsorAnimal?.donation_info || "This organization has not shared donation information for this animal yet."}
            </Text>
            <Pressable style={s.modalCloseBtn} onPress={() => setSponsorAnimal(null)}>
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

  // App bar
  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingVertical: 10, backgroundColor: theme.colors.surface, borderBottomWidth: 0.5, borderBottomColor: theme.colors.border },
  appLogo: { fontSize: 22, fontWeight: "900", color: theme.colors.primary, letterSpacing: -0.5 },
  appBarBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  scroll: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: 120 },

  // CTA Banner
  ctaBanner: { borderRadius: theme.radius.lg, backgroundColor: theme.colors.primaryDeep, padding: theme.spacing.lg, flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  ctaIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  ctaTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaBody: { color: "rgba(255,255,255,0.72)", fontSize: 13, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
  sectionCount: { fontSize: 13, color: theme.colors.inkMuted },

  // Animal card (full width, Instagram post style)
  animalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  animalImage: { width: "100%", height: 220 },
  animalImagePlaceholder: { backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  animalCardBody: { padding: theme.spacing.md, gap: 6 },
  animalCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  followBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  followBtnActive: { backgroundColor: theme.colors.primarySoft },
  animalName: { fontSize: 19, fontWeight: "800", color: theme.colors.ink },
  orgLink: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  cardDesc: { fontSize: 14, color: theme.colors.inkSoft, lineHeight: 20 },

  // Post card
  postCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md, paddingBottom: 8 },
  orgChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  orgChipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  orgChipText: { fontSize: 13, fontWeight: "700", color: theme.colors.ink },
  catBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  postImage: { width: "100%", height: 220 },
  postBody: { padding: theme.spacing.md, gap: 6 },
  postTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.ink },
  postMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  animalLink: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  postDate: { fontSize: 12, color: theme.colors.inkMuted },
  postContent: { fontSize: 14, color: theme.colors.inkSoft, lineHeight: 20 },
  donateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  donateText: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },

  // Empty
  emptyBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.xl, alignItems: "center", gap: theme.spacing.sm },
  emptyText: { fontSize: 14, color: theme.colors.inkMuted, textAlign: "center" },

  // Donation modal (bottom sheet style)
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, gap: theme.spacing.md, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: "center", marginBottom: 4 },
  modalEyebrow: { fontSize: 11, fontWeight: "700", color: theme.colors.inkMuted, textTransform: "uppercase", letterSpacing: 1 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
  modalBody: { fontSize: 15, color: theme.colors.inkSoft, lineHeight: 22 },
  modalCloseBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingVertical: 14, alignItems: "center" },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
