import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandBadge } from "../../../components/brand/BrandHeader";
import Toggle from "../../../components/ui/Toggle";
import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import { logoutUser } from "../../../services/authService";
import { getCurrentLocation } from "../../../services/locationService";
import { getMyReports, MobileCase } from "../../../services/mobileContentService";
import {
  ActivityItem,
  Badge,
  compactPkr,
  getActivity,
  getImpact,
  getProfile,
  Impact,
  Profile,
  updateProfile,
} from "../../../services/profileService";
import { colors, fonts } from "../../../theme/tokens";
import { timeAgo } from "../../../utils/format";

// The Profile screen design (Profilescreen.png): who you are, your rescue impact, badges,
// your reports and your settings.

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  primary: "#00523F",
  secondary: "#006C4F",
  mint: "#86F4C8",
  onMint: "#007153",
  ink: "#0B1C2E",
  soft: "#3F4945",
  outline: "#6F7974",
  urgent: "#A23E32",
};

type Tab = "reports" | "followed" | "badges";
type ReportFilter = "all" | "active" | "resolved" | "critical";
const ACTIVE = ["reported", "assigned", "in_progress"];
const RESOLVED = ["rescued", "adoption", "closed"];
const BADGE_TINTS = [
  { bg: "rgba(0,82,63,0.1)", fg: C.primary },
  { bg: "rgba(134,244,200,0.6)", fg: C.secondary },
  { bg: "#A7F1D7", fg: C.primary },
  { bg: C.container, fg: C.soft },
];

const memberSince = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export default function ProfileScreen() {
  const { isSignedIn, isChecking } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [reports, setReports] = useState<MobileCase[]>([]);
  const [followed, setFollowed] = useState<ActivityItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [tab, setTab] = useState<Tab>("reports");
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, numbers, cases, activity] = await Promise.all([getProfile(), getImpact(), getMyReports(), getActivity()]);
      setProfile(me);
      setImpact(numbers);
      setReports(cases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setFollowed(activity.items.filter((item) => item.kind === "followed_case" || item.kind === "followed_animal"));
      setSavedCount(activity.counts.saved);
      setError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setError(err instanceof Error ? err.message : "We couldn't load your profile.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isSignedIn) load();
    }, [isSignedIn, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const signOut = () =>
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logoutUser() },
    ]);

  if (!isChecking && !isSignedIn) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]} edges={["top"]}>
        <StatusBar style="dark" />
        <BrandBadge size={64} />
        <Text style={styles.guestTitle}>Join the rescue community</Text>
        <Text style={styles.guestText}>Sign in to track your reports, earn badges and see the difference you make.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push("/auth-sheet")} style={styles.primaryPill}>
          <Text style={styles.primaryPillText}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!profile || !impact) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]} edges={["top"]}>
        <StatusBar style="dark" />
        {error ? (
          <>
            <Text style={styles.guestText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.primaryPill}>
              <Text style={styles.primaryPillText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email.split("@")[0];
  const organization = profile.role === "organization";
  const trusted = impact.reports > 0 && (impact.accuracy ?? 0) >= 80;
  const level = impact.level;

  const save = async (changes: Parameters<typeof updateProfile>[0]) => {
    setSaving(true);
    try {
      setProfile(await updateProfile(changes));
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldReady = (value: boolean) => {
    if (value && !profile.phone) {
      Alert.alert("Add a phone number", "Rescue teams need a number to call you about a case near you.", [
        { text: "Not now", style: "cancel" },
        { text: "Add number", onPress: () => router.push("/profile/edit" as Href) },
      ]);
      return;
    }
    save({ field_ready: value });
  };

  const radiusAlerts = () => {
    if (profile.radius_alerts) {
      Alert.alert("Urgent Radius Alerts", `You're alerted about critical cases within ${profile.alert_radius_km} km.`, [
        { text: "Turn off", style: "destructive", onPress: () => save({ radius_alerts: false }) },
        {
          text: "Use my current location",
          onPress: async () => {
            try {
              const spot = await getCurrentLocation();
              save({ radius_alerts: true, alert_latitude: spot.latitude, alert_longitude: spot.longitude });
            } catch (err) {
              Alert.alert("Location needed", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    Alert.alert(
      "Urgent Radius Alerts",
      `Get a notification when someone reports a critical case within ${profile.alert_radius_km} km of where you are now.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Turn on",
          onPress: async () => {
            try {
              const spot = await getCurrentLocation();
              save({ radius_alerts: true, alert_latitude: spot.latitude, alert_longitude: spot.longitude });
            } catch (err) {
              Alert.alert("Location needed", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ]
    );
  };

  const share = () =>
    Share.share({
      message: `I'm a Level ${level.number} ${level.name} on StrayAid: ${impact.reports} ${
        impact.reports === 1 ? "report" : "reports"
      }, ${impact.rescued} rescued and ${impact.badges_earned} badges earned. Join me in helping street animals! 🐾`,
    }).catch(() => null);

  const settings = () =>
    Alert.alert("Settings", profile.email, [
      { text: "Edit profile", onPress: () => router.push("/profile/edit" as Href) },
      { text: "Notifications", onPress: () => router.push("/notifications" as Href) },
      { text: "Policies & terms", onPress: () => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } }) },
      { text: "Delete account", style: "destructive", onPress: () => router.push("/profile/delete-account" as Href) },
      { text: "Sign out", style: "destructive", onPress: signOut },
      { text: "Cancel", style: "cancel" },
    ]);

  const visibleReports = reports.filter((item) =>
    filter === "all"
      ? true
      : filter === "active"
      ? ACTIVE.includes(item.status)
      : filter === "resolved"
      ? RESOLVED.includes(item.status)
      : item.severity === "critical"
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" accessibilityLabel="Share your profile" onPress={share} style={styles.headerButton}>
            <MaterialIcons name="share" size={22} color={C.soft} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={settings} style={styles.headerButton}>
            <MaterialIcons name="settings" size={22} color={C.soft} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Who you are */}
        <View style={styles.card}>
          <View style={styles.who}>
            <View>
              <View style={styles.avatar}>
                {profile.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              {trusted && (
                <View style={styles.avatarBadge}>
                  <MaterialIcons name="verified" size={15} color={colors.onPrimary} />
                </View>
              )}
            </View>
            <View style={styles.whoText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {trusted && <MaterialIcons name="verified-user" size={20} color={C.secondary} />}
              </View>
              <View style={styles.placeRow}>
                <MaterialIcons name="location-on" size={15} color={C.outline} />
                <Text style={styles.place} numberOfLines={1}>
                  {profile.area || "Add your area"}
                </Text>
              </View>
              <Text style={styles.since}>Member since {memberSince(profile.member_since)}</Text>
            </View>
          </View>
          {!organization && (
            <View style={styles.trust}>
              <MaterialIcons name="workspace-premium" size={16} color={C.onMint} />
              <Text style={styles.trustText}>
                Level {level.number} {level.name}
              </Text>
              {impact.accuracy !== null && (
                <>
                  <View style={styles.trustDot} />
                  <Text style={styles.trustStrong}>{impact.accuracy}% Verified Accuracy</Text>
                </>
              )}
            </View>
          )}
          <View style={styles.whoActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/profile/edit" as Href)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}>
              <MaterialIcons name="edit" size={18} color={C.ink} />
              <Text style={styles.editText}>Edit Profile</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share your profile" onPress={share} style={styles.roundButton}>
              <MaterialIcons name="share" size={20} color={C.ink} />
            </Pressable>
          </View>
        </View>

        {!organization && (
          <>
            {/* Community impact */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Community Impact</Text>
                <Text style={styles.logPill}>Verified Log</Text>
              </View>
              <View style={styles.grid}>
                <Tile label="Reports Filed" icon="campaign" color={C.primary} value={String(impact.reports)} />
                <Tile label="Rescued & Treated" icon="healing" color={C.secondary} value={String(impact.rescued)} />
                <Tile label="In Care / Foster" icon="volunteer-activism" color={C.urgent} value={String(impact.in_care)} />
                <Tile label="Funds Pledged" icon="payments" color={C.primary} value={compactPkr(impact.pledged_pkr)} unit="PKR" />
              </View>
              {level.next_points ? (
                <View style={styles.progress}>
                  <View style={styles.progressTop}>
                    <Text style={styles.progressLabel}>
                      {impact.points.toLocaleString("en-US")} / {level.next_points.toLocaleString("en-US")} XP to Level {level.number + 1}{" "}
                      {level.next_name}
                    </Text>
                    <Text style={styles.progressPercent}>{Math.round(level.progress * 100)}%</Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round(level.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressHint}>
                    Just {level.reports_to_next} verified {level.reports_to_next === 1 ? "report" : "reports"} away from achieving{" "}
                    {level.next_name} recognition!
                  </Text>
                </View>
              ) : (
                <Text style={styles.progressHint}>You&apos;ve reached the top level. Thank you, Legend!</Text>
              )}
            </View>

            {/* Badges */}
            <View style={styles.badgesHead}>
              <Text style={styles.cardTitle}>Recognition Badges</Text>
              <Pressable accessibilityRole="button" onPress={() => setTab("badges")} hitSlop={8}>
                <Text style={styles.viewAll}>View All ({impact.badges.length})</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges} style={styles.badgeStrip}>
              {impact.badges.slice(0, 5).map((badge, index) => (
                <BadgeCard key={badge.key} badge={badge} tint={BADGE_TINTS[index % BADGE_TINTS.length]} />
              ))}
            </ScrollView>

            {/* Reports / followed / badges */}
            <View style={styles.segment}>
              {(
                [
                  ["reports", `My Reports (${impact.cases})`],
                  ["followed", `Followed (${followed.length})`],
                  ["badges", "Badges & Stats"],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => setTab(key)}
                  style={[styles.segmentButton, tab === key && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === "reports" && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.badgeStrip}>
                  {(
                    [
                      ["all", "All"],
                      ["active", `Active Cases (${impact.active_cases})`],
                      ["resolved", `Resolved (${impact.rescued})`],
                      ["critical", "Critical Priority"],
                    ] as [ReportFilter, string][]
                  ).map(([key, label]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: filter === key }}
                      onPress={() => setFilter(key)}
                      style={[styles.chip, filter === key && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, key === "critical" && styles.chipCritical, filter === key && styles.chipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {visibleReports.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      {reports.length ? "No reports in this group." : "You haven't reported an animal yet. Every rescue starts with a report."}
                    </Text>
                    {!reports.length && (
                      <Pressable accessibilityRole="button" onPress={() => router.push("/report" as Href)} style={styles.primaryPill}>
                        <Text style={styles.primaryPillText}>Report an Animal</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  visibleReports.map((item) => <ReportCard key={item.id} item={item} />)
                )}
              </>
            )}

            {tab === "followed" &&
              (followed.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Follow a rescue or an animal to keep up with how they&apos;re doing.</Text>
                </View>
              ) : (
                followed.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => router.push((item.link.type === "case" ? `/cases/${item.link.id}` : `/animals/${item.link.id}`) as Href)}
                    style={({ pressed }) => [styles.followRow, pressed && styles.pressed]}
                  >
                    <View style={styles.followImage}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <MaterialIcons name="pets" size={20} color="#BEC9C3" />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.followTitle} numberOfLines={1}>
                        {item.kind === "followed_case" ? `${item.tag} • ${item.subtitle}` : item.title}
                      </Text>
                      <Text style={styles.followSub} numberOfLines={1}>
                        {item.status.label}
                        {item.extra ? ` • ${item.extra}` : ""}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={C.outline} />
                  </Pressable>
                ))
              ))}

            {tab === "badges" && (
              <View style={styles.card}>
                <View style={styles.badgeGrid}>
                  {impact.badges.map((badge, index) => (
                    <BadgeCard key={badge.key} badge={badge} tint={BADGE_TINTS[index % BADGE_TINTS.length]} wide />
                  ))}
                </View>
                <View style={styles.statsList}>
                  <StatRow label="Points" value={impact.points.toLocaleString("en-US")} />
                  <StatRow label="Badges earned" value={`${impact.badges_earned} of ${impact.badges.length}`} />
                  <StatRow label="Adoptions" value={String(impact.adoptions)} />
                  <StatRow label="Comments" value={String(impact.comments)} />
                  <StatRow label="Verified accuracy" value={impact.accuracy === null ? "—" : `${impact.accuracy}%`} />
                </View>
                <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "guidelines" } })}>
                  <Text style={styles.howLink}>How points and badges work</Text>
                </Pressable>
              </View>
            )}

            {/* Emergency field readiness */}
            <View style={styles.ready}>
              <View style={styles.readyTop}>
                <View style={styles.readyLeft}>
                  <View style={styles.readyIcon}>
                    <MaterialCommunityIcons name="hospital-box-outline" size={22} color={C.onMint} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.readyTitle}>Emergency Field Readiness</Text>
                    <Text style={styles.readyText}>Available for rapid on-site case verification</Text>
                  </View>
                </View>
                <Toggle value={profile.field_ready} onChange={toggleFieldReady} label="Emergency field readiness" disabled={saving} />
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push("/profile/edit" as Href)} style={styles.line}>
                <View style={styles.lineLeft}>
                  <MaterialIcons name="lock" size={18} color={C.outline} />
                  <View>
                    <Text style={styles.lineLabel}>Verified Emergency Line</Text>
                    <Text style={styles.lineValue}>{profile.phone_masked || "Add a phone number"}</Text>
                  </View>
                </View>
                <Text style={styles.protected}>{profile.phone ? "Protected" : "Add"}</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Settings */}
        <View style={styles.list}>
          {organization ? (
            <>
              <Row icon="description" title="Adoption Applications" sub="Review who wants to adopt" onPress={() => router.push("/applications" as Href)} />
              <Row icon="chat" title="Messages" sub="Chats with the community" onPress={() => router.push("/messages" as Href)} />
            </>
          ) : (
            <>
              <Row
                icon="notifications-active"
                title="Urgent Radius Alerts"
                sub={profile.radius_alerts ? `On · within ${profile.alert_radius_km} km radius` : "Off · critical cases near you"}
                onPress={radiusAlerts}
              />
              <Row icon="description" title="My Applications" sub="Adoption applications you sent" onPress={() => router.push("/applications" as Href)} />
              <Row
                icon="bookmark"
                title="Saved Posts"
                sub={savedCount ? `${savedCount} saved` : "Bookmark posts to find them here"}
                onPress={() => router.push({ pathname: "/(tabs)/activity", params: { filter: "saved" } } as Href)}
              />
            </>
          )}
          <Row
            icon="help-center"
            title="Volunteer Guidelines & FAQ"
            sub="Islamabad rescue protocol"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "guidelines" } })}
          />
          <Row
            icon="security"
            title="Account & Data Privacy"
            sub={`Signed in as ${profile.email}`}
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })}
          />
          <Row
            icon="gavel"
            title="Policies & Terms"
            sub="Terms, cookies, donations and refunds"
            onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })}
          />
          <Row icon="logout" title="Sign out" sub="" danger onPress={signOut} />
          <Row
            icon="delete-forever"
            title="Delete account"
            sub="Remove your account and personal details"
            danger
            onPress={() => router.push("/profile/delete-account" as Href)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, icon, color, value, unit }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; value: string; unit?: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileTop}>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.tileValue, unit && styles.tileValueSmall]}>
        {value}
        {unit && <Text style={styles.tileUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

const BADGE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  speed: "speed",
  pin_drop: "pin-drop",
  military_tech: "military-tech",
  healing: "healing",
  home: "home",
  favorite: "favorite",
  event_repeat: "event-repeat",
  forum: "forum",
};

function BadgeCard({ badge, tint, wide }: { badge: Badge; tint: { bg: string; fg: string }; wide?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${badge.name}, ${badge.earned ? "earned" : `${badge.progress} of ${badge.goal}`}. ${badge.rule}`}
      style={[styles.badge, wide && styles.badgeWide, !badge.earned && styles.badgeLocked]}
    >
      <View style={[styles.badgeIcon, { backgroundColor: badge.earned ? tint.bg : C.container }]}>
        <MaterialIcons name={BADGE_ICONS[badge.icon] ?? "star"} size={26} color={badge.earned ? tint.fg : "#9AA5A0"} />
      </View>
      <Text style={styles.badgeName} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={styles.badgeRule} numberOfLines={1}>
        {badge.earned ? badge.rule : `${badge.progress} / ${badge.goal} · ${badge.rule}`}
      </Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ReportCard({ item }: { item: MobileCase }) {
  const image = item.reports.find((report) => report.image)?.image;
  const critical = item.severity === "critical" && ACTIVE.includes(item.status);
  const resolved = RESOLVED.includes(item.status);
  const title = [item.title || `${item.species ? item.species[0].toUpperCase() + item.species.slice(1) : "Animal"} in need`]
    .concat(item.area && !(item.title ?? "").includes(item.area) ? [item.area] : [])
    .join(" • ");
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/cases/${item.id}` as Href)} style={({ pressed }) => [styles.card, styles.report, pressed && styles.pressed]}>
      <View style={styles.reportRow}>
        <View style={styles.reportImage}>
          {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name="pets" size={28} color="#BEC9C3" />}
        </View>
        <View style={styles.reportBody}>
          <View style={styles.reportTop}>
            <Text style={styles.reference} numberOfLines={1}>
              #{item.reference}
            </Text>
            {critical ? (
              <View style={[styles.reportPill, styles.pillCritical]}>
                <View style={styles.pillDot} />
                <Text style={styles.pillCriticalText}>Critical</Text>
              </View>
            ) : resolved ? (
              <View style={[styles.reportPill, styles.pillResolved]}>
                <MaterialIcons name="check-circle" size={13} color={C.secondary} />
                <Text style={styles.pillResolvedText}>Resolved</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.reportTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.reportChips}>
            <View style={styles.stateChip}>
              <View style={styles.stateDot} />
              <Text style={styles.stateChipText}>{item.status_label ?? item.status}</Text>
            </View>
            <Text style={styles.orgChip} numberOfLines={1}>
              {item.organization ? `${item.organization.name} Assigned` : "Awaiting a rescue team"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.reportFoot}>
        <View style={styles.footLeft}>
          <MaterialIcons name={resolved ? "calendar-today" : "schedule"} size={15} color={C.outline} />
          <Text style={styles.footText}>
            {resolved
              ? `Reported ${new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : `${timeAgo(item.created_at)} • ${item.update_count ?? 0} team ${item.update_count === 1 ? "update" : "updates"}`}
          </Text>
        </View>
        <View style={styles.footLink}>
          <Text style={styles.footLinkText}>{resolved ? "Case History" : "View Live Status"}</Text>
          {!resolved && <MaterialIcons name="arrow-forward" size={14} color={C.primary} />}
        </View>
      </View>
    </Pressable>
  );
}

function Row({
  icon,
  title,
  sub,
  onPress,
  danger,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
          <MaterialIcons name={icon} size={18} color={danger ? C.urgent : C.soft} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]} numberOfLines={1}>
            {title}
          </Text>
          {!!sub && (
            <Text style={styles.rowSub} numberOfLines={1}>
              {sub}
            </Text>
          )}
        </View>
      </View>
      {!danger && <MaterialIcons name="chevron-right" size={20} color={C.outline} />}
    </Pressable>
  );
}

const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  guestIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  guestTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: C.ink },
  guestText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.soft, textAlign: "center" },
  primaryPill: { marginTop: 6, alignSelf: "center", paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: C.primary },
  primaryPillText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  pressed: { transform: [{ scale: 0.99 }] },
  header: {
    height: 64,
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
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, color: C.ink },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 16 },
  card: { padding: 16, gap: 12, borderRadius: 12, backgroundColor: colors.surface, ...shadow },
  who: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: C.container,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontFamily: fonts.displayBold, fontSize: 26, color: C.primary },
  avatarBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  whoText: { flex: 1, minWidth: 0, justifyContent: "center", paddingTop: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28, color: C.ink },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  place: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  since: { marginTop: 2, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.outline },
  trust: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(134,244,200,0.5)",
  },
  trustText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.onMint },
  trustDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.secondary },
  trustStrong: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: C.onMint },
  whoActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 },
  edit: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: C.low,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.ink },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.low, alignItems: "center", justifyContent: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  logPill: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.container,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.primary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", flexGrow: 1, padding: 12, borderRadius: 8, backgroundColor: C.low, justifyContent: "space-between" },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  tileLabel: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  tileValue: { marginTop: 8, fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, color: C.ink },
  tileValueSmall: { fontSize: 20, lineHeight: 32 },
  tileUnit: { fontFamily: fonts.body, fontSize: 11, color: C.soft },
  progress: { gap: 6, paddingTop: 4 },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  progressLabel: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, color: C.soft },
  progressPercent: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: C.primary },
  bar: { height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: C.container },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: C.primary },
  progressHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.outline },
  badgesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: -8 },
  viewAll: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: C.primary },
  badgeStrip: { marginHorizontal: -16 },
  badges: { paddingHorizontal: 16, paddingVertical: 2, gap: 8 },
  badge: { width: 144, padding: 12, gap: 6, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", ...shadow },
  badgeWide: { width: "48%", flexGrow: 1, backgroundColor: C.low, shadowOpacity: 0, elevation: 0 },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  badgeName: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink, textAlign: "center" },
  badgeRule: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.outline, textAlign: "center" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statsList: { gap: 8, paddingTop: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontFamily: fonts.body, fontSize: 13, color: C.soft },
  statValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.ink },
  howLink: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: C.primary },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: C.low, marginTop: 4 },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.soft },
  segmentTextActive: { color: C.primary },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
  chipActive: { backgroundColor: C.primary, ...shadow },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.ink },
  chipCritical: { color: C.urgent },
  chipTextActive: { color: colors.onPrimary },
  emptyCard: { padding: 20, gap: 8, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", ...shadow },
  emptyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: C.soft, textAlign: "center" },
  report: { gap: 8, marginTop: -4 },
  reportRow: { flexDirection: "row", gap: 12 },
  reportImage: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: C.container,
    alignItems: "center",
    justifyContent: "center",
  },
  reportBody: { flex: 1, minWidth: 0, justifyContent: "space-between" },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  reference: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.outline },
  reportPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillCritical: { backgroundColor: C.urgent },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onPrimary },
  pillCriticalText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: colors.onPrimary },
  pillResolved: { backgroundColor: "rgba(134,244,200,0.6)" },
  pillResolvedText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.secondary },
  reportTitle: { marginTop: 4, fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  reportChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(134,244,200,0.4)",
  },
  stateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.secondary },
  stateChipText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.onMint },
  orgChip: {
    overflow: "hidden",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.container,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.soft,
  },
  reportFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  footLeft: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  footText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.outline },
  footLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  footLinkText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: C.primary },
  followRow: {
    marginTop: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...shadow,
  },
  followImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: C.container,
    alignItems: "center",
    justifyContent: "center",
  },
  followTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.ink },
  followSub: { fontFamily: fonts.body, fontSize: 12, color: C.soft },
  ready: { padding: 16, gap: 8, borderRadius: 12, backgroundColor: C.low },
  readyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  readyLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  readyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  readyTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  readyText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  line: {
    marginTop: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lineLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.outline },
  lineValue: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  protected: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: C.container,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.primary,
  },
  list: { borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, ...shadow },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.low,
  },
  rowPressed: { backgroundColor: C.low },
  rowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  rowIconDanger: { backgroundColor: "#FFDAD5" },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: C.ink },
  rowTitleDanger: { color: C.urgent },
  rowSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.outline },
});
