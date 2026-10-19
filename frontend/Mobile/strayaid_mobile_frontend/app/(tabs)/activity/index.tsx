import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandBadge, BrandTitle } from "../../../components/brand/BrandHeader";
import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import { getUnreadCounts } from "../../../services/inboxService";
import { Activity, ActivityFilter, ActivityItem, compactPkr, getActivity, Tone } from "../../../services/profileService";
import { colors, fonts } from "../../../theme/tokens";
import { shortTime } from "../../../utils/format";

// Stitch screen 24: Activity, everything you reported, follow, applied for, sponsor or saved.

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  highest: "#D3E4FD",
  primary: "#00523F",
  ink: "#0B1C2E",
  soft: "#3F4945",
  mint: "#89F7CB",
  mintDim: "#8CD5BB",
};

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reports", label: "Reports" },
  { key: "followed", label: "Followed" },
  { key: "applications", label: "Applications" },
  { key: "sponsorships", label: "Sponsorships" },
  { key: "saved", label: "Saved" },
];
const KIND_FILTER: Record<ActivityItem["kind"], ActivityFilter> = {
  report: "reports",
  rehomed: "reports",
  followed_case: "followed",
  followed_animal: "followed",
  application: "applications",
  sponsorship: "sponsorships",
  saved: "saved",
};
const KIND_ICON: Record<ActivityItem["kind"], keyof typeof MaterialIcons.glyphMap> = {
  report: "emergency",
  rehomed: "check-circle",
  followed_case: "visibility",
  followed_animal: "visibility",
  application: "pets",
  sponsorship: "favorite",
  saved: "bookmark",
};
const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  green: { bg: "#86F4C8", fg: "#00513B", dot: "#006C4F" },
  amber: { bg: "#FFE8CC", fg: "#8A4B00", dot: "#E08A00" },
  red: { bg: "#FFDAD5", fg: "#A23E32", dot: "#A23E32" },
  blue: { bg: "#DBE9FF", fg: "#00513F", dot: "#1E6B56" },
  grey: { bg: "#E5EEFF", fg: "#3F4945", dot: "#6F7974" },
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Date.now() - date.getTime() < 24 * 3600 * 1000
    ? `${shortTime(iso)} ago`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function hrefFor(item: ActivityItem): Href {
  const { type, id } = item.link;
  if (type === "case") return `/cases/${id}` as Href;
  if (type === "application") return "/applications" as Href;
  if (type === "sponsor") return `/animals/${id}/sponsor` as Href;
  if (type === "post") return `/animals/${item.link.animal_id}/posts?post=${id}` as Href;
  return `/animals/${id}` as Href;
}

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { isSignedIn, isChecking } = useSession();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [query, setQuery] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      setActivity(await getActivity());
      setError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setError(err instanceof Error ? err.message : "We couldn't load your activity.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn) return;
      load();
      getUnreadCounts().then((counts) => setUnread(counts.notifications));
      if (params.filter && FILTERS.some((item) => item.key === params.filter)) setFilter(params.filter as ActivityFilter);
    }, [isSignedIn, load, params.filter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = (activity?.items ?? []).filter(
      (item) => (filter === "all" || KIND_FILTER[item.kind] === filter) && (!search || item.search.includes(search))
    );
    return oldestFirst ? [...rows].reverse() : rows;
  }, [activity, filter, query, oldestFirst]);

  const chooseOrder = () =>
    Alert.alert("Sort timeline", undefined, [
      { text: `${!oldestFirst ? "✓ " : ""}Newest first`, onPress: () => setOldestFirst(false) },
      { text: `${oldestFirst ? "✓ " : ""}Oldest first`, onPress: () => setOldestFirst(true) },
      { text: "Cancel", style: "cancel" },
    ]);

  const shareSummary = () => {
    if (!activity) return;
    const { summary } = activity;
    Share.share({
      message: `My StrayAid impact: ${summary.reports} ${summary.reports === 1 ? "report" : "reports"}, ${summary.adoptions} ${
        summary.adoptions === 1 ? "adoption" : "adoptions"
      } and PKR ${summary.pledged_pkr.toLocaleString("en-US")} pledged for rescued animals. Level ${summary.level.number} ${
        summary.level.name
      } 🐾`,
    }).catch(() => null);
  };

  if (!isChecking && !isSignedIn) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]} edges={["top"]}>
        <StatusBar style="dark" />
        <BrandBadge size={64} />
        <Text style={styles.guestTitle}>Your activity lives here</Text>
        <Text style={styles.guestText}>Sign in to see your reports, followed rescues, applications, sponsorships and saved posts.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/auth-sheet")} style={styles.guestButton}>
          <Text style={styles.guestButtonText}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <BrandTitle title="Activity" />
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort timeline" onPress={chooseOrder} style={styles.headerButton}>
            <MaterialIcons name="tune" size={22} color={C.soft} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
            onPress={() => router.push("/notifications" as Href)}
            style={styles.headerButton}
          >
            <MaterialIcons name="notifications" size={22} color={C.soft} />
            {unread > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!activity ? (
          <View style={styles.state}>
            {error ? (
              <>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={load} style={styles.guestButton}>
                  <Text style={styles.guestButtonText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
        ) : (
          <>
            <LinearGradient
              colors={["#00523F", "#1E6B56", "#006C4F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.impact}
            >
              <View style={styles.impactTop}>
                <View style={styles.impactTitleRow}>
                  <View style={styles.impactIcon}>
                    <MaterialIcons name="volunteer-activism" size={18} color={C.mint} />
                  </View>
                  <View style={styles.flexShrink}>
                    <Text style={styles.impactTitle}>Your Rescue Impact</Text>
                    <Text style={styles.impactSub}>{activity.summary.city} community</Text>
                  </View>
                </View>
                <Text style={styles.levelPill}>
                  Level {activity.summary.level.number} {activity.summary.level.name}
                </Text>
              </View>
              <View style={styles.stats}>
                <Stat value={String(activity.summary.reports)} label={activity.summary.reports === 1 ? "Report" : "Reports"} />
                <Stat
                  value={String(activity.summary.adoptions)}
                  label={activity.summary.adoptions === 1 ? "Adoption" : "Adoptions"}
                  highlight
                />
                <Stat value={compactPkr(activity.summary.pledged_pkr)} label="PKR Pledged" />
              </View>
            </LinearGradient>

            <View style={styles.searchRow}>
              <View style={styles.search}>
                <MaterialIcons name="search" size={20} color={C.soft} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search cases, pet names, ID..."
                  placeholderTextColor="rgba(63,73,69,0.7)"
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="Search your activity"
                />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Sort timeline" onPress={chooseOrder} style={styles.searchButton}>
                <MaterialIcons name="tune" size={20} color={C.soft} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterStrip}>
              {FILTERS.map((item) => {
                const active = item.key === filter;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(item.key)}
                    style={[styles.filter, active && styles.filterActive]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                    <Text style={[styles.filterCount, active && styles.filterCountActive]}>{activity.counts[item.key]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.timelineHead}>
              <View style={styles.timelineTitleRow}>
                <Text style={styles.timelineTitle}>Recent Timeline</Text>
                <Text style={styles.timelineCity}>• {activity.summary.city}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Share your impact" onPress={shareSummary} hitSlop={8}>
                <Text style={styles.export}>Share</Text>
              </Pressable>
            </View>

            {visible.length === 0 ? (
              <Text style={styles.empty}>
                {query ? "Nothing matches your search." : "Nothing here yet. Your rescues, follows and pledges will show up here."}
              </Text>
            ) : (
              visible.map((item) => <TimelineCard key={item.id} item={item} />)
            )}

            <View style={styles.cta}>
              <View style={styles.ctaIcon}>
                <MaterialCommunityIcons name="bell-alert-outline" size={22} color={C.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.ctaTitle}>Spotted an animal in distress?</Text>
                <Text style={styles.ctaText}>Submit a geo-tagged report in 30 seconds</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push("/report" as Href)} style={styles.ctaButton}>
                <Text style={styles.ctaButtonText}>Report</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimelineCard({ item }: { item: ActivityItem }) {
  const tone = TONES[item.status.tone] ?? TONES.grey;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.subtitle}, ${item.status.label}`}
      onPress={() => router.push(hrefFor(item))}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumb}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <MaterialIcons name="pets" size={24} color="#BEC9C3" />
        )}
        <View style={styles.thumbBadge}>
          <MaterialIcons name={KIND_ICON[item.kind]} size={12} color={colors.onPrimary} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!!item.tag && item.kind === "followed_case" && <Text style={styles.tag}>{item.tag}</Text>}
          <Text style={styles.cardDate} numberOfLines={1}>
            {formatDate(item.date)}
          </Text>
        </View>
        <View style={styles.subRow}>
          {item.kind === "report" && <MaterialIcons name="location-on" size={14} color="#A23E32" />}
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <View style={styles.cardBottom}>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
            <Text style={[styles.statusText, { color: tone.fg }]} numberOfLines={1}>
              {item.status.label}
            </Text>
          </View>
          {!!item.extra && (
            <View style={styles.extraRow}>
              {item.kind === "report" && <MaterialIcons name="verified" size={14} color={C.soft} />}
              <Text style={styles.extra} numberOfLines={1}>
                {item.extra}
              </Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={C.soft} />
    </Pressable>
  );
}

const cardShadow = {
  shadowColor: "#243447",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  guestIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  guestTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: C.ink },
  guestText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.soft, textAlign: "center" },
  guestButton: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999, backgroundColor: C.primary },
  guestButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(248,249,255,0.9)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 22, lineHeight: 28, color: C.ink },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.critical,
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 16 },
  state: { alignItems: "center", paddingVertical: 64, gap: 12 },
  stateText: { fontFamily: fonts.body, fontSize: 14, color: C.soft, textAlign: "center" },
  impact: {
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  impactTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  impactTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  impactIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  impactTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 22, color: colors.onPrimary },
  impactSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.mintDim },
  levelPill: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(137,247,203,0.2)",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: C.mint,
  },
  stats: { flexDirection: "row", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  stat: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center" },
  statValue: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, color: colors.onPrimary },
  statValueHighlight: { color: C.mint },
  statLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.mintDim },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: { flex: 1, height: 44, paddingLeft: 12, borderRadius: 12, backgroundColor: C.container, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: "100%", fontFamily: fonts.body, fontSize: 14, color: C.ink },
  searchButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  filterStrip: { marginHorizontal: -16, marginVertical: -4 },
  filters: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  filter: { height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.container, flexDirection: "row", alignItems: "center", gap: 6 },
  filterActive: { backgroundColor: C.primary },
  filterText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.soft },
  filterTextActive: { color: colors.onPrimary },
  filterCount: {
    overflow: "hidden",
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: C.highest,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 15,
    color: C.ink,
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.2)", color: colors.onPrimary },
  timelineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, marginBottom: -4 },
  timelineTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  timelineCity: { fontFamily: fonts.body, fontSize: 12, color: C.soft },
  export: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: C.primary },
  empty: { paddingVertical: 24, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.soft, textAlign: "center" },
  card: {
    marginTop: -4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...cardShadow,
  },
  cardPressed: { transform: [{ scale: 0.99 }] },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.container,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 22, color: C.ink },
  tag: {
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: C.container,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: C.ink,
  },
  cardDate: { marginLeft: "auto", flexShrink: 0, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardSub: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  statusPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 15 },
  extraRow: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  extra: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  cta: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.container,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#A7F1D7", alignItems: "center", justifyContent: "center" },
  ctaTitle: { fontFamily: fonts.displaySemiBold, fontSize: 15, lineHeight: 20, color: C.ink },
  ctaText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  ctaButton: { height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.primary, justifyContent: "center" },
  ctaButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPrimary },
});
