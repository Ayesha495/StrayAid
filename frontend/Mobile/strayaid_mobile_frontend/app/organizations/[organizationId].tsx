import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import TransferSheet from "../../components/donate/TransferSheet";
import MapPreview from "../../components/report/MapPreview";
import { useSession } from "../../hooks/useSession";
import { SessionExpiredError } from "../../services/apiClient";
import { startConversation } from "../../services/chatService";
import { getCurrentLocation, hasLocationPermission } from "../../services/locationService";
import {
  donateToShelter,
  getMyFollows,
  getOrganization,
  getOrganizationAnimals,
  getOrganizationProfile,
  MobileAnimal,
  MobileOrganization,
  OrganizationProfile,
} from "../../services/mobileContentService";
import { followAnimal, followOrganization, unfollowAnimal, unfollowOrganization } from "../../services/notificationService";
import { colors, fonts } from "../../theme/tokens";
import { distanceKm, formatDistance } from "../../utils/format";

// Organization profile (Stitch extra screen "organization_profile_paws_care").

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  high: "#DBE9FF",
  primary: "#00523F",
  green: "#1E6B56",
  secondary: "#006C4F",
  mint: "#86F4C8",
  onMint: "#007153",
  fixed: "#89F7CB",
  ink: "#0B1C2E",
  soft: "#3F4945",
  urgent: "#A23E32",
};

type Filter = "all" | "adoptable" | "treatment" | "adopted";
const STATUS_BADGE: Record<string, { label: string; dot: string }> = {
  adoptable: { label: "Adoptable", dot: C.fixed },
  recovering: { label: "Recovering", dot: "#FF8A80" },
  rescued: { label: "Rescued", dot: "#FFD166" },
  adopted: { label: "Adopted", dot: "#CBD5E1" },
};
const HEALTH: Record<string, string> = {
  healthy: "Treatment Complete",
  minor_issues: "Minor issues",
  under_treatment: "In Treatment",
  special_needs: "Special needs",
};
// Gifts towards medical supplies, as in the design.
const TIERS = [
  { label: "Wound Kit", amount: 500 },
  { label: "Vaccines", amount: 1000 },
  { label: "Full Surgery", amount: 2500 },
];
const PREVIEW = 3;

const pkr = (value: number) => `PKR ${value.toLocaleString("en-US")}`;

function initials(name: string) {
  const parts = name.replace("&", " ").split(" ").filter((part) => /^[A-Za-z]/.test(part));
  return parts.length >= 2 ? `${parts[0][0]}&${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function describe(animal: MobileAnimal) {
  const age = animal.age == null ? null : animal.age < 1 ? "Under 1 yr" : `${animal.age} ${animal.age === 1 ? "yr" : "yrs"}`;
  return [animal.breed || animal.species, age, animal.gender].filter(Boolean).join(" • ");
}

export default function OrganizationScreen() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const { isSignedIn } = useSession();
  const [organization, setOrganization] = useState<MobileOrganization | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [animals, setAnimals] = useState<MobileAnimal[]>([]);
  const [followedAnimals, setFollowedAnimals] = useState<number[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [tier, setTier] = useState(1000);
  const [donating, setDonating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [org, details, list] = await Promise.all([
        getOrganization(organizationId),
        getOrganizationProfile(organizationId),
        getOrganizationAnimals(organizationId),
      ]);
      setOrganization(org);
      setProfile(details);
      setAnimals(list);
      setError(null);
      getMyFollows()
        .then((follows) => setFollowedAnimals(follows.followed_animals))
        .catch(() => null);
      // Distance only when location is already allowed: no permission prompt on a profile.
      if (org.latitude != null && org.longitude != null && (await hasLocationPermission())) {
        const here = await getCurrentLocation().catch(() => null);
        if (here) setDistance(distanceKm(here, { latitude: org.latitude, longitude: org.longitude }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this organization.");
    }
  }, [organizationId]);

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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));
  const requireAccount = (action: () => void) => (isSignedIn ? action() : router.push("/auth-sheet"));

  if (!organization || !profile) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={load} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const inCare = animals.filter((animal) => animal.status !== "adopted");
  const groups: Record<Filter, MobileAnimal[]> = {
    all: inCare,
    adoptable: animals.filter((animal) => animal.status === "adoptable"),
    treatment: animals.filter((animal) => animal.status === "recovering" || animal.status === "rescued"),
    adopted: animals.filter((animal) => animal.status === "adopted"),
  };
  const shown = showAll ? groups[filter] : groups[filter].slice(0, PREVIEW);
  const hasLocation = organization.latitude != null && organization.longitude != null;
  const place = [organization.address, organization.is_verified && "Verified Welfare NGO", organization.city].filter(Boolean).join(" • ");

  const toggleFollow = () =>
    requireAccount(async () => {
      const next = !profile.following;
      setProfile({ ...profile, following: next, stats: { ...profile.stats, followers: profile.stats.followers + (next ? 1 : -1) } });
      try {
        await (next ? followOrganization(organization.id) : unfollowOrganization(organization.id));
      } catch {
        setProfile(profile);
      }
    });

  const toggleAnimal = (animal: MobileAnimal) =>
    requireAccount(async () => {
      const following = followedAnimals.includes(animal.id);
      setFollowedAnimals((ids) => (following ? ids.filter((id) => id !== animal.id) : [...ids, animal.id]));
      try {
        await (following ? unfollowAnimal(animal.id) : followAnimal(animal.id));
      } catch {
        setFollowedAnimals((ids) => (following ? [...ids, animal.id] : ids.filter((id) => id !== animal.id)));
      }
    });

  const call = () => {
    if (!organization.phone_number) {
      Alert.alert(organization.name, "This organization hasn't added a phone number yet.");
      return;
    }
    Linking.openURL(`tel:${organization.phone_number.replace(/\s/g, "")}`).catch(() => null);
  };

  const message = () =>
    requireAccount(async () => {
      try {
        const conversation = await startConversation({ organizationId: organization.id });
        router.push(`/messages/${conversation.id}` as Href);
      } catch (err) {
        if (err instanceof SessionExpiredError) router.push("/auth-sheet");
        else Alert.alert("Couldn't open the chat", err instanceof Error ? err.message : "Please try again.");
      }
    });

  const share = () =>
    Share.share({ message: `${organization.name} rescues street animals in ${organization.city || "Pakistan"}. Find them on StrayAid.` }).catch(
      () => null
    );

  const directions = () => {
    if (!hasLocation) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${organization.latitude},${organization.longitude}`
    ).catch(() => null);
  };

  const showOptions = () =>
    Alert.alert(organization.name, undefined, [
      { text: "Message the shelter", onPress: message },
      { text: "Share profile", onPress: share },
      ...(hasLocation ? [{ text: "Get directions", onPress: directions }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);

  const startDonation = () =>
    requireAccount(() => {
      if (!organization.bank_account_number) {
        Alert.alert(organization.name, "This organization hasn't added bank details yet. Message them to help.");
        return;
      }
      if (profile.my_pending_donation) {
        Alert.alert("Receipt being checked", `${organization.name} is still checking your last gift. Thank you!`);
        return;
      }
      setDonating(true);
    });

  const action = (animal: MobileAnimal) => {
    if (animal.status === "adoptable") {
      if (animal.my_application) return { label: "Applied", run: () => router.push("/applications" as Href) };
      return { label: "Adopt Me", run: () => requireAccount(() => router.push(`/animals/${animal.id}/adopt` as Href)) };
    }
    if (animal.status === "adopted") return { label: "Story", run: () => router.push(`/animals/${animal.id}` as Href) };
    return { label: animal.health === "under_treatment" ? "Send Aid" : "Sponsor", run: () => router.push(`/animals/${animal.id}/sponsor` as Href) };
  };

  const info = (animal: MobileAnimal) => {
    if (animal.status === "adoptable" && animal.application_count)
      return { icon: "assignment" as const, text: `${animal.application_count} ${animal.application_count === 1 ? "Application" : "Applications"} In`, tone: "blue" };
    if (animal.status === "adopted") return { icon: "home" as const, text: "Forever home", tone: "green" };
    if (animal.health === "under_treatment") return { icon: "healing" as const, text: "In Treatment", tone: "red" };
    return { icon: "check-circle-outline" as const, text: HEALTH[animal.health ?? ""] ?? "In our care", tone: "green" };
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.headerButton}>
            <MaterialIcons name="arrow-back" size={24} color={C.ink} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Shelter Profile
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={showOptions} style={styles.headerButton}>
          <MaterialIcons name="more-vert" size={22} color={C.soft} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.hubPill}>
            <View style={[styles.hubDot, !profile.is_available && styles.hubDotOff]} />
            <Text style={styles.hubText}>{profile.is_available ? "Active Response Hub" : "At full capacity"}</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Message ${organization.name}`} onPress={message} style={styles.roundSmall}>
              <MaterialIcons name="chat-bubble-outline" size={19} color={C.primary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={share} style={styles.roundSmall}>
              <MaterialIcons name="share" size={20} color={C.soft} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cover}>
            {organization.image && <Image source={{ uri: organization.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            <LinearGradient colors={["transparent", "rgba(33,49,68,0.3)", "rgba(33,49,68,0.8)"]} style={StyleSheet.absoluteFill} />
            {organization.is_verified && (
              <View style={styles.reg}>
                <MaterialIcons name="verified" size={16} color={C.primary} />
                <Text style={styles.regText}>{organization.tax_id ? `Reg #${organization.tax_id}` : "Verified"}</Text>
              </View>
            )}
          </View>
          <View style={styles.identity}>
            <View style={styles.identityTop}>
              <View style={styles.badge}>
                <View style={styles.badgeInner}>
                  <MaterialIcons name="pets" size={26} color={C.primary} />
                  <Text style={styles.badgeText}>{initials(organization.name)}</Text>
                </View>
              </View>
              {!!organization.radius && (
                <View style={styles.rangePill}>
                  <MaterialIcons name="schedule" size={15} color={C.primary} />
                  <Text style={styles.rangeText}>Covers {organization.radius} km</Text>
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{organization.name}</Text>
              {organization.is_verified && <MaterialIcons name="verified" size={20} color={C.primary} />}
            </View>
            {!!place && <Text style={styles.place}>{place}</Text>}

            <View style={styles.stats}>
              <Stat value={profile.stats.rescued} label="Rescued" color={C.primary} />
              <Stat value={profile.stats.adopted} label="Adopted" color={C.primary} />
              <Stat value={profile.stats.in_care} label="In Care" color={C.secondary} />
              <Stat value={profile.stats.followers} label="Followers" color={C.ink} />
            </View>

            <View style={styles.ctas}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: profile.following }}
                onPress={toggleFollow}
                style={({ pressed }) => [styles.follow, profile.following && styles.followOn, pressed && styles.pressed]}
              >
                <MaterialIcons name={profile.following ? "favorite" : "favorite-border"} size={18} color={profile.following ? C.green : colors.onPrimary} />
                <Text style={[styles.followText, profile.following && styles.followTextOn]}>{profile.following ? "Following" : "Follow Org"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={call} style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
                <MaterialIcons name="call" size={18} color={C.primary} />
                <Text style={styles.callText}>Emergency Call</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.mission]}>
          <View style={styles.missionHead}>
            <View style={styles.missionTitleRow}>
              <MaterialIcons name="info-outline" size={20} color={C.primary} />
              <Text style={styles.sectionTitle}>Mission & Protocol</Text>
            </View>
            <Text style={styles.typeTag}>{organization.is_verified ? "Non-Profit" : profile.type ? profile.type[0].toUpperCase() + profile.type.slice(1) : "Rescue"}</Text>
          </View>
          <Text style={styles.missionText}>
            {organization.description || `${organization.name} rescues and cares for street animals in ${organization.city || "the area"}.`}
          </Text>
          {hasLocation && (
            <View style={styles.mapBox}>
              <MapPreview location={{ latitude: organization.latitude!, longitude: organization.longitude! }} />
              <View style={styles.mapCard}>
                <View style={styles.mapLeft}>
                  <View style={styles.mapIcon}>
                    <MaterialIcons name="pin-drop" size={18} color={C.primary} />
                  </View>
                  <View style={styles.flexShrink}>
                    <Text style={styles.mapTitle} numberOfLines={1}>
                      {organization.address || organization.city}
                    </Text>
                    <Text style={styles.mapSub} numberOfLines={1}>
                      {[organization.city, distance != null && `${formatDistance(distance)} away`].filter(Boolean).join(" • ")}
                    </Text>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Open directions" onPress={directions} style={styles.navigate}>
                  <MaterialIcons name="navigation" size={16} color={colors.onPrimary} />
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.careHead}>
          <View>
            <Text style={styles.sectionTitle}>Animals in Care</Text>
            <Text style={styles.careSub}>
              {inCare.length} {inCare.length === 1 ? "animal" : "animals"} being cared for
            </Text>
          </View>
          {groups[filter].length > PREVIEW && (
            <Pressable accessibilityRole="button" onPress={() => setShowAll((value) => !value)} style={styles.viewAll}>
              <Text style={styles.viewAllText}>{showAll ? "Show less" : `View All (${groups[filter].length})`}</Text>
              <MaterialIcons name={showAll ? "expand-less" : "chevron-right"} size={16} color={C.primary} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipStrip}>
          {(
            [
              ["all", `All (${groups.all.length})`],
              ["adoptable", `Ready for Adoption (${groups.adoptable.length})`],
              ["treatment", `In Treatment (${groups.treatment.length})`],
              ["adopted", `Adopted (${groups.adopted.length})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={[styles.chip, filter === key && styles.chipOn]}
            >
              <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {shown.length === 0 && <Text style={styles.empty}>No animals in this group right now.</Text>}
        {shown.map((animal) => {
          const badge = STATUS_BADGE[animal.status] ?? STATUS_BADGE.rescued;
          const detail = info(animal);
          const cta = action(animal);
          const following = followedAnimals.includes(animal.id);
          return (
            <Pressable
              key={animal.id}
              accessibilityRole="button"
              accessibilityLabel={`${animal.name}, ${badge.label}`}
              onPress={() => router.push(`/animals/${animal.id}` as Href)}
              style={({ pressed }) => [styles.animal, pressed && styles.pressed]}
            >
              <View style={styles.animalImage}>
                {animal.image ? (
                  <Image source={{ uri: animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <MaterialIcons name="pets" size={28} color="#BEC9C3" />
                )}
                <View style={styles.animalBadge}>
                  <View style={[styles.animalBadgeDot, { backgroundColor: badge.dot }]} />
                  <Text style={styles.animalBadgeText}>{badge.label}</Text>
                </View>
              </View>
              <View style={styles.animalBody}>
                <View style={styles.animalTop}>
                  <View style={styles.flexShrink}>
                    <Text style={styles.animalName} numberOfLines={1}>
                      {animal.name}
                    </Text>
                    <Text style={styles.animalMeta} numberOfLines={1}>
                      {describe(animal)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={following ? `Stop following ${animal.name}` : `Follow ${animal.name}`}
                    onPress={() => toggleAnimal(animal)}
                    hitSlop={6}
                    style={styles.heart}
                  >
                    <MaterialIcons name={following ? "favorite" : "favorite-border"} size={18} color={following ? "#E5484D" : C.primary} />
                  </Pressable>
                </View>
                <View style={styles.animalBottom}>
                  <View style={[styles.infoChip, detail.tone === "red" ? styles.infoRed : detail.tone === "blue" ? styles.infoBlue : styles.infoGreen]}>
                    <MaterialIcons
                      name={detail.icon}
                      size={13}
                      color={detail.tone === "red" ? C.urgent : detail.tone === "blue" ? C.soft : C.secondary}
                    />
                    <Text
                      style={[styles.infoText, detail.tone === "red" ? styles.infoTextRed : detail.tone === "blue" ? styles.infoTextBlue : styles.infoTextGreen]}
                      numberOfLines={1}
                    >
                      {detail.text}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cta.run}
                    style={[styles.ctaPill, animal.status !== "adoptable" && styles.ctaPillSoft]}
                  >
                    <Text style={[styles.ctaPillText, animal.status !== "adoptable" && styles.ctaPillTextSoft]}>{cta.label}</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.impact}>
          <View style={styles.impactEyebrow}>
            <View style={styles.impactIcon}>
              <MaterialCommunityIcons name="medical-bag" size={14} color={C.fixed} />
            </View>
            <Text style={styles.impactEyebrowText}>Direct Shelter Impact</Text>
          </View>
          <Text style={styles.impactTitle}>Sponsor Shelter Medical Supplies</Text>
          <Text style={styles.impactText}>
            Every contribution directly funds anti-rabies vaccines, wound antiseptic, and nutrient meals for street rescues.
          </Text>
          <View style={styles.tiers}>
            {TIERS.map((item) => {
              const on = item.amount === tier;
              return (
                <Pressable
                  key={item.amount}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.label}, ${pkr(item.amount)}`}
                  onPress={() => setTier(item.amount)}
                  style={[styles.tier, on && styles.tierOn]}
                >
                  <Text style={[styles.tierLabel, on && styles.tierLabelOn]}>{item.label}</Text>
                  <Text style={[styles.tierAmount, on && styles.tierAmountOn]}>{pkr(item.amount)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.fund}>
            <View style={styles.fundTop}>
              <Text style={styles.fundLabel}>{profile.fund.month} Medical Supply Fund</Text>
              <Text style={styles.fundPercent}>{profile.fund.percent}% Funded</Text>
            </View>
            <View style={styles.fundBar}>
              <View style={[styles.fundFill, { width: `${profile.fund.percent}%` }]} />
            </View>
            <View style={styles.fundBottom}>
              <Text style={styles.fundSmall}>{pkr(profile.fund.raised_pkr)} raised</Text>
              <Text style={styles.fundSmall}>Target: {pkr(profile.fund.goal_pkr)}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={startDonation} style={({ pressed }) => [styles.pledge, pressed && styles.pressed]}>
            <MaterialIcons name="volunteer-activism" size={20} color={C.primary} />
            <Text style={styles.pledgeText}>Pledge {pkr(tier)} Support</Text>
          </Pressable>
        </View>
      </ScrollView>

      <TransferSheet
        visible={donating}
        title={`Transfer ${pkr(tier)}`}
        body={`Send it to ${organization.name}'s account below, then attach the receipt so they can confirm your gift.`}
        bank={{ bank: organization.bank_name, title: organization.bank_account_title, number: organization.bank_account_number }}
        thanks={{
          title: `Thank you for supporting ${organization.name}!`,
          body: `They'll check your receipt and confirm your ${pkr(tier)} gift. We'll send you a notification when it's confirmed.`,
        }}
        onSend={async (receipt) => {
          await donateToShelter(organization.id, tier, receipt);
          load();
        }}
        onClose={() => setDonating(false)}
      />
    </SafeAreaView>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  pressed: { transform: [{ scale: 0.98 }] },
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  scroll: { paddingBottom: 40 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  hubPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: C.mint },
  hubDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  hubDotOff: { backgroundColor: C.urgent },
  hubText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.onMint },
  topActions: { flexDirection: "row", gap: 4 },
  roundSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.low, alignItems: "center", justifyContent: "center" },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, ...cardShadow },
  cover: { height: 144, backgroundColor: C.container },
  reg: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  regText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.primary },
  identity: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  identityTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: -48, marginBottom: 12 },
  badge: { width: 80, height: 80, padding: 4, borderRadius: 16, backgroundColor: C.green, ...cardShadow },
  badgeInner: { flex: 1, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.displayBold, fontSize: 10, letterSpacing: 0.6, color: C.primary },
  rangePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.low },
  rangeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.ink },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, color: C.ink },
  place: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: C.soft },
  stats: { flexDirection: "row", marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: "rgba(238,244,255,0.7)" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28 },
  statLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  ctas: { flexDirection: "row", gap: 12, marginTop: 16 },
  follow: { flex: 1, height: 48, borderRadius: 999, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  followOn: { backgroundColor: C.mint },
  followText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  followTextOn: { color: C.green },
  callButton: { flex: 1, height: 48, borderRadius: 999, backgroundColor: C.high, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  callText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.primary },
  mission: { padding: 16, gap: 12 },
  missionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  missionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  typeTag: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(134,244,200,0.5)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.secondary,
  },
  missionText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: C.soft },
  mapBox: { height: 128, marginTop: 8, borderRadius: 12, overflow: "hidden", backgroundColor: C.container },
  mapCard: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mapLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  mapIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  mapTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  mapSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  navigate: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  careHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  careSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  viewAll: { flexDirection: "row", alignItems: "center" },
  viewAllText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: C.primary },
  chipStrip: { marginBottom: 8 },
  chips: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: C.high },
  chipOn: { backgroundColor: C.green },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.soft },
  chipTextOn: { color: colors.onPrimary },
  empty: { paddingHorizontal: 16, paddingVertical: 16, fontFamily: fonts.body, fontSize: 13, color: C.soft },
  animal: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...cardShadow,
  },
  animalImage: { width: 96, height: 96, borderRadius: 8, overflow: "hidden", backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  animalBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(30,107,86,0.9)",
  },
  animalBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  animalBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, color: colors.onPrimary },
  animalBody: { flex: 1, minWidth: 0 },
  animalTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  animalName: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  animalMeta: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  heart: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.low, alignItems: "center", justifyContent: "center" },
  animalBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8 },
  infoChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  infoGreen: { backgroundColor: "rgba(134,244,200,0.4)" },
  infoRed: { backgroundColor: "#FFDAD5" },
  infoBlue: { backgroundColor: C.container },
  infoText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14 },
  infoTextGreen: { color: C.secondary },
  infoTextRed: { color: C.urgent },
  infoTextBlue: { color: C.soft },
  ctaPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: C.green },
  ctaPillSoft: { backgroundColor: C.mint },
  ctaPillText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: colors.onPrimary },
  ctaPillTextSoft: { color: C.onMint },
  impact: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: C.green, ...cardShadow },
  impactEyebrow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  impactIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  impactEyebrowText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase", color: C.fixed },
  impactTitle: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 26, color: colors.onPrimary },
  impactText: { marginTop: 4, marginBottom: 16, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.8)" },
  tiers: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tier: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  tierOn: { backgroundColor: C.fixed },
  tierLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10, lineHeight: 13, color: "rgba(255,255,255,0.7)" },
  tierLabelOn: { color: "rgba(0,82,63,0.8)" },
  tierAmount: { fontFamily: fonts.displaySemiBold, fontSize: 16, lineHeight: 22, color: colors.onPrimary },
  tierAmountOn: { color: C.primary },
  fund: { padding: 12, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)", marginBottom: 16 },
  fundTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  fundLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: colors.onPrimary },
  fundPercent: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: C.fixed },
  fundBar: { height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.2)" },
  fundFill: { height: "100%", borderRadius: 999, backgroundColor: C.fixed },
  fundBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  fundSmall: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: "rgba(255,255,255,0.7)" },
  pledge: { height: 48, borderRadius: 999, backgroundColor: C.fixed, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pledgeText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: C.primary },
});
