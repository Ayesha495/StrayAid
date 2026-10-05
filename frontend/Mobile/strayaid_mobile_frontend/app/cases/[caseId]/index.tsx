import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Toggle from "../../../components/ui/Toggle";
import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import {
  CaseDetail,
  CaseStatus,
  getCase,
  getCaseUpdates,
  getUpdatesSeenAt,
  setCaseKeepUpdated,
} from "../../../services/caseService";
import { registerForPushNotifications, sendPushTokenToBackend } from "../../../services/notificationService";
import type { Severity } from "../../../services/reportDraft";
import { colors, fonts } from "../../../theme/tokens";
import { timeAgo } from "../../../utils/format";

// Stitch screen 10: Rescue case details.

const NAVY = "#243447";
const GRAY = "#747474";
const BORDER = "#E8ECE9";
const SURFACE = "#F8FAF9";

const MILESTONES: { status: CaseStatus; label: string }[] = [
  { status: "reported", label: "Reported" },
  { status: "assigned", label: "Assigned" },
  { status: "in_progress", label: "In Progress" },
  { status: "rescued", label: "Rescued" },
  { status: "closed", label: "Closed" },
];

const STATUS_PILL: Record<CaseStatus, { label: string; color: string; background: string; border: string }> = {
  reported: { label: "Reported", color: "#B7791F", background: "#FEF7ED", border: "rgba(244,176,96,0.35)" },
  assigned: { label: "Assigned", color: colors.primary, background: colors.mint, border: "rgba(30,107,86,0.2)" },
  in_progress: { label: "In Progress", color: colors.primary, background: colors.mint, border: "rgba(30,107,86,0.2)" },
  rescued: { label: "Rescued", color: colors.primary, background: colors.mint, border: "rgba(30,107,86,0.2)" },
  adoption: { label: "For Adoption", color: colors.primary, background: colors.mint, border: "rgba(30,107,86,0.2)" },
  closed: { label: "Closed", color: "#475569", background: "#F1F5F9", border: "#E2E8F0" },
};

const SEVERITY_CHIP: Record<Severity, { label: string; color: string; background: string }> = {
  low: { label: "Low severity", color: "#1E8A66", background: "#E8F7F2" },
  medium: { label: "Medium severity", color: "#B7791F", background: "#FEF7ED" },
  high: { label: "High severity", color: colors.critical, background: "#FDEEEC" },
  critical: { label: "Critical severity", color: "#B42318", background: "#FDECEC" },
};

// "G-11, Islamabad" -> "Islamabad • Sector G-11". Without a city in the area, the
// organization's city is used if there is one.
function formatArea(area: string, fallbackCity?: string) {
  const [place, ownCity] = area.split(",").map((part) => part.trim());
  const city = ownCity || fallbackCity;
  if (!place) return "";
  const label = /^[A-Z]-\d+(\/\d+)?$/i.test(place) ? `Sector ${place.toUpperCase()}` : place;
  return city ? `${city} • ${label}` : label;
}

// How far along the milestones a case is. "For adoption" means the rescue part is done.
function milestoneProgress(status: CaseStatus) {
  if (status === "closed") return { done: MILESTONES.length, current: -1 };
  if (status === "adoption") return { done: 4, current: -1 };
  const index = MILESTONES.findIndex((step) => step.status === status);
  return { done: index, current: index };
}

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: color },
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }]} />
    </View>
  );
}

function Milestones({ status }: { status: CaseStatus }) {
  const { done, current } = milestoneProgress(status);
  const [centers, setCenters] = useState<number[]>([]);

  const onStepLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setCenters((previous) => {
      const next = [...previous];
      next[index] = x + width / 2;
      return next;
    });
  };

  const measured = centers.length === MILESTONES.length && centers.every((value) => value !== undefined);
  const lastReached = current >= 0 ? current : Math.min(done, MILESTONES.length) - 1;

  return (
    <View style={styles.milestones}>
      <Text style={styles.milestonesTitle}>Rescue Milestones</Text>
      <View style={styles.track} accessible accessibilityLabel={`Rescue progress: ${STATUS_PILL[status].label}`}>
        {measured && (
          <>
            <View style={[styles.trackLine, { left: centers[0], width: centers[MILESTONES.length - 1] - centers[0] }]} />
            {lastReached > 0 && (
              <View style={[styles.trackLine, styles.trackFilled, { left: centers[0], width: centers[lastReached] - centers[0] }]} />
            )}
          </>
        )}
        {MILESTONES.map((step, index) => {
          const isCurrent = index === current;
          const isDone = !isCurrent && index < done;
          return (
            <View key={step.status} style={styles.step} onLayout={onStepLayout(index)}>
              <View style={[styles.stepCircle, isDone && styles.stepDone, isCurrent && styles.stepCurrent]}>
                {isDone ? (
                  <MaterialIcons name="check" size={15} color={colors.onPrimary} />
                ) : (
                  <View style={isCurrent ? styles.stepCurrentDot : styles.stepFutureDot} />
                )}
              </View>
              <Text style={[styles.stepLabel, isDone && styles.stepLabelDone, isCurrent && styles.stepLabelCurrent]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PhotoViewer({ images, visible, onClose }: { images: string[]; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const width = Dimensions.get("window").width;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <FlatList
          data={images}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={{ width, height: "100%" }} contentFit="contain" />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          onPress={onClose}
          style={[styles.viewerClose, { top: insets.top + 12 }]}
        >
          <MaterialIcons name="close" size={22} color={colors.onPrimary} />
        </Pressable>
        {images.length > 1 && (
          <Text style={[styles.viewerHint, { bottom: insets.bottom + 20 }]}>Swipe to see all {images.length} photos</Text>
        )}
      </View>
    </Modal>
  );
}

export default function CaseDetailsScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [newUpdates, setNewUpdates] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [keepUpdated, setKeepUpdated] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, updates, seenAt] = await Promise.all([
        getCase(caseId),
        getCaseUpdates(caseId),
        getUpdatesSeenAt(Number(caseId)),
      ]);
      setItem(detail);
      setKeepUpdated(detail.keep_updated);
      setNewUpdates(updates.filter((update) => new Date(update.created_at).getTime() > seenAt).length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this case.");
    }
  }, [caseId]);

  // Reload on focus: counts change after opening Case Updates, and sign-in changes keep_updated.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));
  const openConfidence = () => router.push(`/cases/${caseId}/confidence` as Href);

  const share = () => {
    if (!item) return;
    Share.share({
      message: `${item.title} (Case #${item.reference}) on StrayAid: ${STATUS_PILL[item.status].label}. ${item.description}`,
    }).catch(() => null);
  };

  const toggleUpdates = async (value: boolean) => {
    if (!item) return;
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    setKeepUpdated(value);
    setSavingUpdates(true);
    try {
      await setCaseKeepUpdated(item.id, value);
      if (value) {
        registerForPushNotifications()
          .then((token) => (token ? sendPushTokenToBackend(token) : undefined))
          .catch(() => null);
      }
    } catch (err) {
      setKeepUpdated(!value);
      if (err instanceof SessionExpiredError) router.push("/auth-sheet");
      else Alert.alert("Couldn't change updates", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSavingUpdates(false);
    }
  };

  // Chat (Stitch 18-19) isn't built yet, so this offers the organization's phone and email.
  const contactOrganization = () => {
    const organization = item?.organization;
    if (!organization) return;
    const options = [
      organization.phone && { text: `Call ${organization.phone}`, onPress: () => Linking.openURL(`tel:${organization.phone}`) },
      organization.email && {
        text: "Send an email",
        onPress: () =>
          Linking.openURL(`mailto:${organization.email}?subject=${encodeURIComponent(`Case #${item.reference}`)}`),
      },
    ].filter(Boolean) as { text: string; onPress: () => void }[];
    if (!options.length) {
      Alert.alert(organization.name, "This organization hasn't added contact details yet.");
      return;
    }
    Alert.alert(`Contact ${organization.name}`, `About case #${item.reference}`, [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (!item) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <StatusBar style="dark" />
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={load} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={goBack} accessibilityRole="button">
              <Text style={styles.linkText}>Go back</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const status = STATUS_PILL[item.status] ?? STATUS_PILL.reported;
  const severity = SEVERITY_CHIP[item.severity] ?? SEVERITY_CHIP.medium;
  const verified = item.confidence_score != null && item.confidence_score >= 70 && !item.possibly_invalid;
  // One photo per case: the report that started it. Other sightings are under Related Reports.
  const photos = item.image ? [item.image] : [];
  const organization = item.organization;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <MaterialIcons name="chevron-left" size={26} color={NAVY} />
        </Pressable>
        <View style={styles.navTitle}>
          <Text style={styles.navHeading} accessibilityRole="header">
            Case #{item.reference}
          </Text>
          {!!item.area && <Text style={styles.navSub}>{formatArea(item.area, item.organization?.city)}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share case"
          onPress={share}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <Feather name="share" size={18} color={NAVY} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.hero}>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <MaterialIcons name="pets" size={44} color="#CBD5E1" />
            )}
            {verified && (
              <Pressable accessibilityRole="button" onPress={openConfidence} style={styles.aiPill}>
                <PulsingDot color={colors.secondary} />
                <Text style={styles.aiPillText}>AI Verified Rescue</Text>
              </Pressable>
            )}
            {item.possibly_invalid && (
              <Pressable accessibilityRole="button" onPress={openConfidence} style={styles.aiPill}>
                <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.aiPillText, { color: "#B7791F" }]}>Needs verification</Text>
              </Pressable>
            )}
            {photos.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View photo fullscreen"
                onPress={() => setViewerOpen(true)}
                style={styles.expand}
              >
                <MaterialIcons name="open-in-full" size={16} color={colors.onPrimary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{item.title}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: status.background, borderColor: status.border }]}>
              {item.status === "closed" ? (
                <View style={[styles.dot, { backgroundColor: "#94A3B8" }]} />
              ) : (
                <PulsingDot color={item.status === "reported" ? colors.warning : colors.secondary} />
              )}
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          {/* Full width so longer labels ("Medium severity") stay on one line beside the AI chip. */}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: severity.background }]}>
              <MaterialIcons name="warning-amber" size={13} color={severity.color} />
              <Text style={[styles.chipText, { color: severity.color }]}>{severity.label}</Text>
            </View>
            {item.confidence_score != null && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.confidence_score}% AI confidence. Open the breakdown`}
                onPress={openConfidence}
                hitSlop={6}
                style={({ pressed }) => [styles.chip, { backgroundColor: colors.mint }, pressed && { opacity: 0.7 }]}
              >
                <Feather name="loader" size={12} color={colors.secondary} />
                <Text style={[styles.chipText, { color: colors.secondary }]}>{item.confidence_score}% confidence</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            accessibilityRole={organization ? "button" : undefined}
            disabled={!organization}
            onPress={() => organization && router.push(`/organizations/${organization.id}` as Href)}
            style={styles.orgRow}
          >
            <View style={styles.orgLeft}>
              <View style={styles.orgAvatar}>
                {organization?.image ? (
                  <Image source={{ uri: organization.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <MaterialIcons name={organization ? "favorite" : "pets"} size={16} color={colors.primary} />
                )}
              </View>
              <View style={styles.orgText}>
                <Text style={styles.orgName} numberOfLines={1}>
                  {organization ? organization.name : "No organization yet"}
                </Text>
                <Text style={styles.orgSub} numberOfLines={1}>
                  {organization
                    ? [organization.city, organization.type && `${organization.type[0].toUpperCase()}${organization.type.slice(1)} organization`]
                        .filter(Boolean)
                        .join(" · ")
                    : "Nearby rescuers notified"}
                </Text>
              </View>
            </View>
            <View style={styles.reported}>
              <Feather name="clock" size={12} color={GRAY} />
              <Text style={styles.reportedText}>Reported {timeAgo(item.created_at)}</Text>
            </View>
          </Pressable>

          {!!item.description && <Text style={styles.description}>{item.description}</Text>}
        </View>

        <Milestones status={item.status} />

        <View style={styles.controls}>
          <View style={styles.updatesCard}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, styles.bellIcon]}>
                <Feather name="bell" size={15} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.rowTitle}>Keep me updated</Text>
                <Text style={styles.rowSub}>Get notification on status change</Text>
              </View>
            </View>
            <Toggle label="Keep me updated" value={keepUpdated} onChange={toggleUpdates} disabled={savingUpdates} />
          </View>

          <View style={styles.links}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/cases/${item.id}/updates?reference=${item.reference}` as Href)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.linkPressed]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Feather name="file-text" size={15} color="#475569" />
                </View>
                <Text style={styles.linkLabel}>Case Updates</Text>
                {newUpdates > 0 && <Text style={styles.newBadge}>{newUpdates} new</Text>}
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/cases/${item.id}/reports?reference=${item.reference}` as Href)}
              style={({ pressed }) => [styles.linkRow, styles.linkDivider, pressed && styles.linkPressed]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Feather name="grid" size={15} color="#475569" />
                </View>
                <Text style={styles.linkLabel}>Related Reports</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !item.animal }}
              disabled={!item.animal}
              onPress={() => item.animal && router.push(`/animals/${item.animal.id}` as Href)}
              style={({ pressed }) => [styles.linkRow, styles.linkDivider, pressed && styles.linkPressed]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <MaterialIcons name="pets" size={15} color="#475569" />
                </View>
                <Text style={styles.linkLabel}>Animal Profile</Text>
              </View>
              {item.animal ? (
                <Feather name="chevron-right" size={16} color="#94A3B8" />
              ) : (
                <Text style={styles.linkHint}>After rescue</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !organization }}
          disabled={!organization}
          onPress={contactOrganization}
          style={({ pressed }) => [styles.chat, pressed && styles.chatPressed, !organization && styles.chatWaiting]}
        >
          <Feather name="message-square" size={17} color={colors.onPrimary} />
          <Text style={styles.chatText}>{organization ? "Chat with Organization" : "Waiting for an organization"}</Text>
        </Pressable>
      </View>

      <PhotoViewer images={photos} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  linkText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  navPressed: { backgroundColor: "#F1F5F9" },
  navTitle: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  navHeading: { fontFamily: fonts.displaySemiBold, fontSize: 14, lineHeight: 20, letterSpacing: -0.3, color: NAVY },
  navSub: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: GRAY },
  scroll: { paddingBottom: 96 },
  heroWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  hero: {
    height: 208,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  aiPill: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  aiPillText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16, letterSpacing: -0.2, color: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  expand: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  titleBlock: { flex: 1 },
  title: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: NAVY },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 16 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
  orgRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  orgLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  orgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30,107,86,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  orgText: { flex: 1 },
  orgName: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: NAVY },
  orgSub: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: GRAY },
  reported: { flexDirection: "row", alignItems: "center", gap: 4 },
  reportedText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: GRAY },
  description: { marginTop: 12, fontFamily: fonts.body, fontSize: 12, lineHeight: 19.5, color: "#475569" },
  milestones: {
    marginVertical: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  milestonesTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: GRAY,
    marginBottom: 14,
  },
  track: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  trackLine: { position: "absolute", top: 11, height: 2, backgroundColor: "#E2E8F0" },
  trackFilled: { backgroundColor: colors.primary },
  step: { alignItems: "center" },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: { borderWidth: 0, backgroundColor: colors.primary },
  stepCurrent: {
    borderWidth: 0,
    backgroundColor: colors.primary,
    // Tailwind's ring-4 ring-mint.
    outlineColor: colors.mint,
    outlineWidth: 4,
    outlineStyle: "solid",
  },
  stepCurrentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  stepFutureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  stepLabel: { marginTop: 4, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: GRAY },
  stepLabelDone: { fontFamily: fonts.bodyBold, color: colors.primary },
  stepLabelCurrent: { fontFamily: fonts.displayExtraBold, color: NAVY },
  controls: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 },
  updatesCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: colors.surface,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { borderRadius: 8, backgroundColor: colors.mint },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: NAVY },
  rowSub: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: GRAY },
  links: { borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: colors.surface, overflow: "hidden" },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  linkDivider: { borderTopWidth: 1, borderTopColor: BORDER },
  linkPressed: { backgroundColor: "#F8FAFC" },
  linkLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: NAVY },
  linkHint: { fontFamily: fonts.bodyMedium, fontSize: 11, color: "#94A3B8" },
  newBadge: {
    overflow: "hidden",
    marginLeft: -4,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 14,
    color: colors.primary,
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
  chat: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  chatPressed: { backgroundColor: "#165242", transform: [{ scale: 0.99 }] },
  chatWaiting: { backgroundColor: "#94A3B8", shadowOpacity: 0 },
  chatText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
  viewer: { flex: 1, backgroundColor: "#000000" },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerHint: {
    position: "absolute",
    alignSelf: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
});
