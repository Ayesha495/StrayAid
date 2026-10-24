import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionExpiredError } from "../../services/apiClient";
import { startConversation } from "../../services/chatService";
import {
  ApplicationStatus,
  getMyApplications,
  MyApplication,
  withdrawApplication,
} from "../../services/mobileContentService";
import { colors, fonts } from "../../theme/tokens";

// Stitch screen 15: My Applications.

const NAVY = "#1E293B";
const MUTED = "#64748B";

type Tab = "all" | ApplicationStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "withdrawn", label: "Withdrawn" },
];

type Sort = "newest" | "oldest" | "name";
const SORT_LABELS: Record<Sort, string> = { newest: "Newest first", oldest: "Oldest first", name: "Animal name (A–Z)" };

const STATUS_STYLE: Record<ApplicationStatus, { label: string; bg: string; fg: string; border: string }> = {
  pending: { label: "Pending", bg: "#FFFBEB", fg: "#D97706", border: "rgba(253,230,138,0.6)" },
  approved: { label: "Approved", bg: "#ECFDF5", fg: "#35A982", border: "rgba(167,243,208,0.6)" },
  rejected: { label: "Rejected", bg: "#FFF1F2", fg: "#F47C6C", border: "rgba(254,205,211,0.6)" },
  withdrawn: { label: "Withdrawn", bg: "#F1F5F9", fg: "#64748B", border: "rgba(226,232,240,0.8)" },
};

const HOME_LABELS: Record<string, string> = { apartment: "Apartment", house: "House", other: "Other home" };
const EXPERIENCE_LABELS: Record<string, string> = {
  first_time: "First pet",
  some: "Had pets before",
  experienced: "Very experienced",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function StatusPill({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <View style={[styles.pill, { backgroundColor: style.bg, borderColor: style.border }]}>
      {status === "pending" && <View style={[styles.pillDot, { backgroundColor: "#F59E0B" }]} />}
      {status === "approved" && <Feather name="check" size={12} color={style.fg} style={styles.pillIcon} />}
      {status === "rejected" && <Feather name="x" size={12} color={style.fg} style={styles.pillIcon} />}
      {status === "withdrawn" && <MaterialIcons name="block" size={12} color={style.fg} style={styles.pillIcon} />}
      <Text style={[styles.pillText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

export default function MyApplicationsScreen() {
  const insets = useSafeAreaInsets();
  const [applications, setApplications] = useState<MyApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [open, setOpen] = useState<MyApplication | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setApplications(await getMyApplications());
      setError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.replace("/auth-sheet");
        return;
      }
      setError(err instanceof Error ? err.message : "We couldn't load your applications.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    const rows = (applications ?? []).filter((row) => tab === "all" || row.status === tab);
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.animal.name.localeCompare(b.animal.name);
      const order = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sort === "newest" ? order : -order;
    });
  }, [applications, tab, sort]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));

  const chooseSort = () =>
    Alert.alert("Sort applications", undefined, [
      ...(Object.keys(SORT_LABELS) as Sort[]).map((key) => ({
        text: `${sort === key ? "✓ " : ""}${SORT_LABELS[key]}`,
        onPress: () => setSort(key),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);

  const withdraw = (application: MyApplication) =>
    Alert.alert(
      `Withdraw your application for ${application.animal.name}?`,
      `${application.animal.organization?.name ?? "The organization"} will be told. You can apply again later if ${application.animal.name} is still available.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await withdrawApplication(application.id);
              setApplications((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) ?? null);
              setOpen(updated);
            } catch (err) {
              Alert.alert("Couldn't withdraw", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );

  const message = async (application: MyApplication) => {
    setBusy(true);
    try {
      const conversation = await startConversation({ animalId: application.animal.id });
      setOpen(null);
      router.push(`/messages/${conversation.id}` as Href);
    } catch (err) {
      Alert.alert("Couldn't open the chat", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          My Applications
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort applications, ${SORT_LABELS[sort]}`}
          onPress={chooseSort}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Feather name="sliders" size={18} color={NAVY} />
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.key)}
                style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!applications ? (
          <View style={styles.state}>
            {error ? (
              <>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.state}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="pets" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === "all" ? "No applications yet" : `No ${STATUS_STYLE[tab].label.toLowerCase()} applications`}
            </Text>
            <Text style={styles.stateText}>
              {tab === "all"
                ? "When you apply to adopt an animal, you can follow the organization's review here."
                : "Applications move here when their status changes."}
            </Text>
            {tab === "all" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/explore" as Href)}
                style={styles.retry}
              >
                <Text style={styles.retryText}>Find animals to adopt</Text>
              </Pressable>
            )}
          </View>
        ) : (
          visible.map((application) => (
            <Pressable
              key={application.id}
              accessibilityRole="button"
              accessibilityLabel={`${application.animal.name}, ${application.animal.organization?.name ?? ""}, ${
                STATUS_STYLE[application.status].label
              }, applied ${formatDate(application.created_at)}`}
              onPress={() => setOpen(application)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.thumb}>
                {application.animal.image ? (
                  <Image source={{ uri: application.animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <MaterialIcons name="pets" size={24} color="#CBD5E1" />
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {application.animal.name}
                  </Text>
                  <Text style={styles.date}>{formatDate(application.created_at)}</Text>
                </View>
                <Text style={styles.org} numberOfLines={1}>
                  {application.animal.organization?.name}
                </Text>
                <View style={styles.cardBottom}>
                  <StatusPill status={application.status} />
                  <Feather name="chevron-right" size={16} color="#CBD5E1" />
                </View>
              </View>
            </Pressable>
          ))
        )}

        {!!applications && (
          <View style={styles.note}>
            <View style={styles.noteIcon}>
              <Feather name="info" size={14} color={colors.primary} />
            </View>
            <Text style={styles.noteText}>
              Applications typically take 2-4 business days to review by the rescue organization.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(null)}>
          {open && (
            <Pressable accessible={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => null}>
              <View style={styles.handle} />
              <View style={styles.sheetHead}>
                <View style={[styles.thumb, styles.sheetThumb]}>
                  {open.animal.image ? (
                    <Image source={{ uri: open.animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <MaterialIcons name="pets" size={24} color="#CBD5E1" />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.sheetName}>{open.animal.name}</Text>
                  <Text style={styles.org}>{open.animal.organization?.name}</Text>
                  <View style={styles.sheetPill}>
                    <StatusPill status={open.status} />
                  </View>
                </View>
              </View>

              <View style={styles.timeline}>
                <TimelineRow icon="send" label="Applied" value={formatDate(open.created_at)} done />
                {open.status === "pending" ? (
                  <TimelineRow icon="clock" label="Under review" value="Usually 2-4 business days" />
                ) : (
                  <TimelineRow
                    icon={open.status === "approved" ? "check-circle" : open.status === "rejected" ? "x-circle" : "slash"}
                    label={STATUS_STYLE[open.status].label}
                    value={open.decided_at ? formatDate(open.decided_at) : ""}
                    done
                  />
                )}
              </View>
              {open.status === "approved" && (
                <Text style={styles.sheetHint}>
                  {open.animal.organization?.name} will call you on {open.phone} to arrange a visit.
                </Text>
              )}

              <View style={styles.answers}>
                <Answer label="Phone" value={open.phone} />
                <Answer
                  label="Home"
                  value={[HOME_LABELS[open.home_type], open.ownership === "rent" ? "rented" : "owned", open.city]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <Answer
                  label="Household"
                  value={`${open.household_size} ${open.household_size === 1 ? "person" : "people"}${
                    open.has_children ? ", with children" : ""
                  }${open.has_other_pets ? ", other pets" : ""}`}
                />
                <Answer label="Experience" value={EXPERIENCE_LABELS[open.experience] ?? "—"} />
                <Answer label="Why adopt" value={open.reason} />
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => message(open)}
                  style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                >
                  <Feather name="message-square" size={16} color={colors.onPrimary} />
                  <Text style={styles.primaryText}>Message shelter</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setOpen(null);
                    router.push(`/animals/${open.animal.id}` as Href);
                  }}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryText}>View {open.animal.name}</Text>
                </Pressable>
              </View>
              {(open.status === "pending" || open.status === "approved") && (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => withdraw(open)} style={styles.withdraw}>
                  <Text style={styles.withdrawText}>{busy ? "Please wait…" : "Withdraw application"}</Text>
                </Pressable>
              )}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TimelineRow({ icon, label, value, done }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; done?: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineIcon, done && styles.timelineIconDone]}>
        <Feather name={icon} size={13} color={done ? colors.primary : "#94A3B8"} />
      </View>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineValue}>{value}</Text>
    </View>
  );
}

function Answer({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.answer}>
      <Text style={styles.answerLabel}>{label}</Text>
      <Text style={styles.answerValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAF9" },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  title: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 28, letterSpacing: -0.45, color: NAVY },
  tabs: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: MUTED },
  tabTextActive: { color: colors.onPrimary },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  cardPressed: { transform: [{ scale: 0.99 }], borderColor: "#E2E8F0" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 24, color: NAVY },
  date: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: "#64748B" },
  org: { marginTop: 2, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: MUTED },
  cardBottom: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  pillIcon: { marginRight: 4 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16 },
  note: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(53,169,130,0.2)",
    backgroundColor: "rgba(231,244,238,0.4)",
  },
  noteIcon: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    backgroundColor: "rgba(53,169,130,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 19.5, color: "rgba(30,107,86,0.9)" },
  state: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 16, gap: 10 },
  stateText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: MUTED, textAlign: "center" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: NAVY },
  retry: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPrimary },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginBottom: 16 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  sheetThumb: { width: 72, height: 72, borderRadius: 16 },
  sheetName: { fontFamily: fonts.displayExtraBold, fontSize: 20, lineHeight: 26, color: NAVY },
  sheetPill: { marginTop: 8 },
  timeline: { marginTop: 18, gap: 10 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconDone: { backgroundColor: colors.mint },
  timelineLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: NAVY },
  timelineValue: { marginLeft: "auto", fontFamily: fonts.body, fontSize: 12, color: MUTED },
  sheetHint: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.mint,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.primary,
  },
  answers: { marginTop: 16, padding: 14, gap: 10, borderRadius: 16, backgroundColor: "#F8FAF9", borderWidth: 1, borderColor: "#EEF2F0" },
  answer: { flexDirection: "row", gap: 12 },
  answerLabel: { width: 82, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 18, color: "#64748B" },
  answerValue: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#334155" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryPressed: { backgroundColor: "#165242" },
  primaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.onPrimary },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EAF3F0",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.primary },
  withdraw: { alignItems: "center", paddingVertical: 14 },
  withdrawText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.critical },
});
