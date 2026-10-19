import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandTitle } from "../components/brand/BrandHeader";
import { useSession } from "../hooks/useSession";
import { getMapCases, TrendingCase } from "../services/homeService";
import { getCurrentLocation, hasLocationPermission } from "../services/locationService";
import {
  DirectoryOrganization,
  getMyFollows,
  getOrganizationDirectory,
  getPublicAnimals,
  MobileAnimal,
} from "../services/mobileContentService";
import { followAnimal, unfollowAnimal } from "../services/notificationService";
import { saveRescueContacts } from "../services/offlineQueue";
import type { LatLng } from "../services/reportDraft";
import { colors, fonts } from "../theme/tokens";
import { distanceKm, formatDistance } from "../utils/format";

// Stitch extra screen "search_explore": search animals, rescue cases and shelters, with
// species and quick filters, recent searches and animals that need help now.

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  variant: "#D3E4FD",
  primary: "#00523F",
  green: "#1E6B56",
  secondary: "#006C4F",
  mint: "#86F4C8",
  onMint: "#007153",
  onMintDeep: "#00513B",
  ink: "#0B1C2E",
  soft: "#3F4945",
  pinkBg: "#FFDAD5",
  pinkText: "#410000",
  errorBg: "#FFDAD6",
  errorText: "#93000A",
  error: "#BA1A1A",
};

const RECENT_KEY = "strayaid.recentSearches";
const NEAR_KM = 5;
const RECENT_HOURS = 48;

type Species = "all" | "dog" | "cat" | "bird" | "other";
type Quick = "near" | "critical" | "adoptable" | "recent";

const SPECIES: { key: Species; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "all", label: "All", icon: "apps" },
  { key: "dog", label: "Dogs", icon: "dog" },
  { key: "cat", label: "Cats", icon: "cat" },
  { key: "bird", label: "Birds", icon: "bird" },
  { key: "other", label: "Other", icon: "rabbit" },
];
const QUICK: { key: Quick; label: string }[] = [
  { key: "near", label: `Near Me (<${NEAR_KM}km)` },
  { key: "critical", label: "Critical Triage" },
  { key: "adoptable", label: "Ready for Adoption" },
  { key: "recent", label: "Recently Reported" },
];
const ANIMAL_BADGE: Record<string, string> = { rescued: "Rescued", recovering: "In Care", adoptable: "Ready", adopted: "Adopted" };
const HEALTH: Record<string, string> = {
  healthy: "Healthy",
  minor_issues: "Minor issues",
  under_treatment: "Post-Surgery Recovery",
  special_needs: "Special needs",
};

const speciesOf = (value?: string) => {
  const text = (value || "").toLowerCase();
  if (text.includes("dog") || text.includes("pup")) return "dog";
  if (text.includes("cat") || text.includes("kitten")) return "cat";
  if (text.includes("bird")) return "bird";
  return "other";
};
const ageLabel = (age?: number | null) => (age == null ? null : age < 1 ? "Under 1 yr" : `${age} ${age === 1 ? "yr" : "yrs"}`);
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600000;
const initials = (name: string) => {
  const parts = name.replace("&", " ").split(" ").filter((part) => /^[A-Za-z]/.test(part));
  return parts.length >= 2 ? `${parts[0][0]}&${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function SearchScreen() {
  const { isSignedIn } = useSession();
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState<Species>("all");
  const [quick, setQuick] = useState<Quick[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [animals, setAnimals] = useState<MobileAnimal[] | null>(null);
  const [cases, setCases] = useState<TrendingCase[]>([]);
  const [organizations, setOrganizations] = useState<DirectoryOrganization[]>([]);
  const [followed, setFollowed] = useState<number[]>([]);
  const [me, setMe] = useState<LatLng | null>(null);
  const [byDistance, setByDistance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => setRecent(raw ? JSON.parse(raw) : []))
      .catch(() => null);
    Promise.all([getPublicAnimals(), getMapCases(), getOrganizationDirectory()])
      .then(([animalList, caseList, orgList]) => {
        setAnimals(animalList);
        setCases(caseList);
        setOrganizations(orgList);
        saveRescueContacts(orgList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "We couldn't load search."));
    // Distances only when location is already allowed; "Near Me" asks for it.
    hasLocationPermission().then((allowed) => {
      if (allowed) getCurrentLocation().then(setMe).catch(() => null);
    });
  }, []);

  useEffect(() => {
    if (isSignedIn) getMyFollows().then((follows) => setFollowed(follows.followed_animals)).catch(() => null);
  }, [isSignedIn]);

  const remember = useCallback(
    (text: string) => {
      const value = text.trim();
      if (value.length < 2) return;
      const next = [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 6);
      setRecent(next);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => null);
    },
    [recent]
  );

  const forget = (text?: string) => {
    const next = text ? recent.filter((item) => item !== text) : [];
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => null);
  };

  const toggleQuick = async (key: Quick) => {
    if (key === "near" && !me && !quick.includes("near")) {
      try {
        setMe(await getCurrentLocation());
      } catch (err) {
        Alert.alert("Location needed", err instanceof Error ? err.message : "Allow location to find animals near you.");
        return;
      }
    }
    setQuick((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const orgById = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization])), [organizations]);

  const animalDistance = useCallback(
    (animal: MobileAnimal) => {
      const organization = orgById.get(animal.organization.id);
      if (!me || organization?.latitude == null || organization.longitude == null) return null;
      return distanceKm(me, { latitude: organization.latitude, longitude: organization.longitude });
    },
    [me, orgById]
  );

  const text = query.trim().toLowerCase();

  const shownAnimals = useMemo(() => {
    let rows = (animals ?? []).filter((animal) => species === "all" || speciesOf(animal.species) === species);
    if (text) {
      rows = rows.filter((animal) =>
        [animal.name, animal.breed, animal.species, animal.organization.name, animal.area, animal.organization.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(text))
      );
    }
    if (quick.includes("adoptable")) rows = rows.filter((animal) => animal.status === "adoptable");
    if (quick.includes("critical")) rows = rows.filter((animal) => animal.health === "under_treatment" || animal.health === "special_needs");
    if (quick.includes("recent")) rows = rows.filter((animal) => hoursSince(animal.created_at) <= RECENT_HOURS);
    if (quick.includes("near")) rows = rows.filter((animal) => (animalDistance(animal) ?? Infinity) <= NEAR_KM);
    if (!text && !quick.includes("adoptable")) rows = rows.filter((animal) => animal.status !== "adopted");
    return [...rows].sort((a, b) =>
      byDistance && me
        ? (animalDistance(a) ?? Infinity) - (animalDistance(b) ?? Infinity)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [animals, species, text, quick, animalDistance, byDistance, me]);

  const shownCases = useMemo(() => {
    let rows = cases.filter((item) => species === "all" || speciesOf(item.species || item.title) === species);
    if (text) rows = rows.filter((item) => [item.title, item.area, item.species].some((value) => (value || "").toLowerCase().includes(text)));
    if (quick.includes("critical")) rows = rows.filter((item) => item.severity === "critical" || item.severity === "high");
    if (quick.includes("recent")) rows = rows.filter((item) => hoursSince(item.created_at) <= RECENT_HOURS);
    if (quick.includes("near") && me) rows = rows.filter((item) => distanceKm(me, item) <= NEAR_KM);
    if (quick.includes("adoptable")) rows = [];
    return rows;
  }, [cases, species, text, quick, me]);

  const shownOrganizations = useMemo(
    () =>
      text
        ? organizations.filter((organization) =>
            [organization.name, organization.city, organization.address].some((value) => (value || "").toLowerCase().includes(text))
          )
        : [],
    [organizations, text]
  );

  // An animal that needs a quiet home to recover in, shown at the top until you search.
  const featured = useMemo(
    () => (animals ?? []).find((animal) => animal.status !== "adopted" && (animal.health === "under_treatment" || animal.health === "special_needs")),
    [animals]
  );

  const hub = useMemo(() => {
    const verified = organizations.filter((organization) => organization.is_verified);
    const pool = verified.length ? verified : organizations;
    if (!me) return pool[0];
    return [...pool].sort((a, b) => {
      const da = a.latitude != null && a.longitude != null ? distanceKm(me, { latitude: a.latitude, longitude: a.longitude }) : Infinity;
      const db = b.latitude != null && b.longitude != null ? distanceKm(me, { latitude: b.latitude, longitude: b.longitude }) : Infinity;
      return da - db;
    })[0];
  }, [organizations, me]);

  const toggleFollow = (animal: MobileAnimal) => {
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    const following = followed.includes(animal.id);
    setFollowed((ids) => (following ? ids.filter((id) => id !== animal.id) : [...ids, animal.id]));
    (following ? unfollowAnimal(animal.id) : followAnimal(animal.id)).catch(() =>
      setFollowed((ids) => (following ? [...ids, animal.id] : ids.filter((id) => id !== animal.id)))
    );
  };

  const open = (href: Href) => {
    remember(query);
    router.push(href);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/explore"));
  const searching = !!text || quick.length > 0 || species !== "all";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}>
            <MaterialIcons name="arrow-back" size={24} color={C.ink} />
          </Pressable>
          <BrandTitle title="Explore" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <MaterialIcons name="search" size={20} color={C.soft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => remember(query)}
              placeholder="Search animals, cases or shelters"
              placeholderTextColor="rgba(63,73,69,0.6)"
              style={styles.searchInput}
              returnKeyType="search"
              autoFocus
              accessibilityLabel="Search animals, cases or shelters"
            />
            {!!query && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={8} style={styles.clear}>
                <MaterialIcons name="close" size={15} color={C.soft} />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${byDistance ? "newest" : "distance"}`}
            onPress={() => setByDistance((value) => !value)}
            style={styles.tune}
          >
            <MaterialIcons name="tune" size={22} color={C.onMint} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.strip} keyboardShouldPersistTaps="handled">
          {SPECIES.map((item) => {
            const on = item.key === species;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSpecies(item.key)}
                style={[styles.species, on && styles.speciesOn]}
              >
                <MaterialCommunityIcons name={item.icon} size={17} color={on ? colors.onPrimary : C.primary} />
                <Text style={[styles.speciesText, on && styles.speciesTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.strip} keyboardShouldPersistTaps="handled">
          {QUICK.map((item) => {
            const on = quick.includes(item.key);
            const tone = item.key === "critical" ? styles.quickCritical : item.key === "adoptable" ? styles.quickAdopt : styles.quickPlain;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                onPress={() => toggleQuick(item.key)}
                style={[styles.quick, tone, on && styles.quickOn]}
              >
                {item.key === "near" && <MaterialIcons name="near-me" size={14} color={on ? colors.onPrimary : C.secondary} />}
                {item.key === "critical" && <View style={[styles.criticalDot, on && styles.criticalDotOn]} />}
                {item.key === "adoptable" && <MaterialIcons name="favorite-border" size={14} color={on ? colors.onPrimary : C.onMintDeep} />}
                {item.key === "recent" && <MaterialIcons name="history" size={14} color={on ? colors.onPrimary : C.soft} />}
                <Text
                  style={[
                    styles.quickText,
                    item.key === "critical" && styles.quickTextCritical,
                    item.key === "adoptable" && styles.quickTextAdopt,
                    on && styles.quickTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!text && recent.length > 0 && (
          <View style={styles.recent}>
            <View style={styles.recentHead}>
              <Text style={styles.recentTitle}>Recent Searches</Text>
              <Pressable accessibilityRole="button" onPress={() => forget()} hitSlop={8}>
                <Text style={styles.clearAll}>Clear All</Text>
              </Pressable>
            </View>
            <View style={styles.recentChips}>
              {recent.map((item) => (
                <View key={item} style={styles.recentChip}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Search ${item}`} onPress={() => setQuery(item)} style={styles.recentLeft}>
                    <MaterialIcons name="schedule" size={14} color={C.soft} />
                    <Text style={styles.recentText}>{item}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item}`} onPress={() => forget(item)} hitSlop={8}>
                    <MaterialIcons name="close" size={13} color={C.soft} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {!animals ? (
          <View style={styles.state}>
            {error ? <Text style={styles.stateText}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
          </View>
        ) : (
          <>
            {!searching && featured && (
              <View style={styles.featured}>
                <View style={styles.featuredTop}>
                  <View style={styles.urgent}>
                    <View style={styles.urgentDot} />
                    <Text style={styles.urgentText}>{featured.health === "special_needs" ? "Special Care Needed" : "Emergency Foster Needed"}</Text>
                  </View>
                  {!!(featured.area || featured.organization.city) && (
                    <View style={styles.featuredPlace}>
                      <MaterialIcons name="wrong-location" size={14} color={C.error} />
                      <Text style={styles.featuredPlaceText} numberOfLines={1}>
                        {[featured.area && `Sector ${featured.area}`, featured.organization.city].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable accessibilityRole="button" onPress={() => open(`/animals/${featured.id}` as Href)} style={styles.featuredBody}>
                  <View style={styles.featuredImage}>
                    {featured.image && <Image source={{ uri: featured.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                    {!!ageLabel(featured.age) && <Text style={styles.ageTag}>{ageLabel(featured.age)}</Text>}
                  </View>
                  <View style={styles.featuredText}>
                    <View style={styles.featuredNameRow}>
                      <Text style={styles.featuredName} numberOfLines={1}>
                        {featured.name}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={followed.includes(featured.id) ? `Stop following ${featured.name}` : `Follow ${featured.name}`}
                        onPress={() => toggleFollow(featured)}
                        hitSlop={8}
                      >
                        <MaterialIcons
                          name={followed.includes(featured.id) ? "favorite" : "favorite-border"}
                          size={22}
                          color={followed.includes(featured.id) ? "#E5484D" : C.soft}
                        />
                      </Pressable>
                    </View>
                    <Text style={styles.featuredMeta} numberOfLines={1}>
                      {[featured.breed || featured.species, HEALTH[featured.health ?? ""]].filter(Boolean).join(" • ")}
                    </Text>
                    {!!featured.medical_info && (
                      <View style={styles.needRow}>
                        <MaterialIcons name="volunteer-activism" size={14} color={C.primary} />
                        <Text style={styles.need} numberOfLines={1}>
                          {featured.medical_info}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
                <View style={styles.featuredActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => open(`/animals/${featured.id}/sponsor` as Href)}
                    style={({ pressed }) => [styles.foster, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="hand-heart" size={20} color={colors.onPrimary} />
                    <Text style={styles.fosterText}>Help {featured.name}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${featured.name}`}
                    onPress={() =>
                      Share.share({ message: `${featured.name} needs help recovering at ${featured.organization.name}. Find them on StrayAid.` }).catch(() => null)
                    }
                    style={styles.shareButton}
                  >
                    <MaterialIcons name="share" size={20} color={C.primary} />
                  </Pressable>
                </View>
              </View>
            )}

            {searching && shownCases.length > 0 && (
              <>
                <SectionHead title="Rescue Cases" count={`${shownCases.length} Open`} />
                {shownCases.slice(0, 6).map((item) => (
                  <Pressable key={item.id} accessibilityRole="button" onPress={() => open(`/cases/${item.id}` as Href)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <View style={styles.rowImage}>
                      {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name="pets" size={26} color="#BEC9C3" />}
                      <Text style={[styles.rowBadge, item.severity === "critical" && styles.rowBadgeCritical]}>{item.status_label}</Text>
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {me && <Text style={styles.rowDistance}>{formatDistance(distanceKm(me, item))}</Text>}
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[item.area, `${item.report_count} ${item.report_count === 1 ? "report" : "reports"}`].filter(Boolean).join(" • ")}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.infoChip, item.severity === "critical" || item.severity === "high" ? styles.infoRed : styles.infoMint]}>
                          <MaterialIcons name="priority-high" size={13} color={item.severity === "critical" || item.severity === "high" ? C.error : C.onMint} />
                          <Text style={[styles.infoText, item.severity === "critical" || item.severity === "high" ? styles.infoTextRed : styles.infoTextMint]}>
                            {item.severity[0].toUpperCase() + item.severity.slice(1)} priority
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={C.soft} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            <View style={styles.sectionGap}>
              <SectionHead
                title={searching ? "Animals" : "Community Cases"}
                count={`${shownAnimals.length} ${searching ? "Found" : "Active"}`}
                sort={me ? (byDistance ? "Sort: Distance" : "Sort: Newest") : undefined}
                onSort={() => setByDistance((value) => !value)}
              />
            </View>
            {shownAnimals.length === 0 && (
              <Text style={styles.empty}>{text ? `No animals match “${query.trim()}”.` : "No animals match these filters."}</Text>
            )}
            {shownAnimals.slice(0, searching ? 30 : 8).map((animal) => {
              const distance = animalDistance(animal);
              const pledge = animal.my_sponsorship;
              const application = animal.my_application;
              const goal = Math.max(animal.sponsor_goal ?? 1, 1);
              return (
                <Pressable key={animal.id} accessibilityRole="button" onPress={() => open(`/animals/${animal.id}` as Href)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={styles.rowImage}>
                    {animal.image ? <Image source={{ uri: animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name="pets" size={26} color="#BEC9C3" />}
                    <Text style={styles.rowBadge}>{application ? "Pending" : ANIMAL_BADGE[animal.status] ?? "Rescued"}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {animal.name}
                      </Text>
                      {distance != null && <Text style={styles.rowDistance}>{formatDistance(distance)}</Text>}
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[animal.breed || animal.species, ageLabel(animal.age)].filter(Boolean).join(" • ")}
                    </Text>
                    <View style={styles.rowBottom}>
                      <View style={[styles.infoChip, pledge ? styles.infoMint : styles.infoBlue]}>
                        <MaterialIcons
                          name={pledge ? "volunteer-activism" : application ? "home" : animal.vaccinated ? "medical-services" : "healing"}
                          size={13}
                          color={pledge ? C.onMint : C.primary}
                        />
                        <Text style={[styles.infoText, pledge ? styles.infoTextMint : styles.infoTextBlue]} numberOfLines={1}>
                          {pledge
                            ? `PKR ${pledge.amount_pkr.toLocaleString("en-US")}${pledge.monthly ? "/mo" : ""} Sponsor`
                            : application
                            ? `Adoption review: ${application.status}`
                            : animal.vaccinated
                            ? "Vaccination Complete"
                            : HEALTH[animal.health ?? ""] ?? "In care"}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={C.soft} />
                    </View>
                    {!!pledge && (
                      <View style={styles.progress}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, ((animal.sponsor_count ?? 0) / goal) * 100)}%` }]} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {shownOrganizations.length > 0 && <SectionHead title="Shelters" count={`${shownOrganizations.length} Found`} />}
            {shownOrganizations.map((organization) => (
              <HubCard key={organization.id} organization={organization} onOpen={() => open(`/organizations/${organization.id}` as Href)} />
            ))}

            {!!text && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  remember(query);
                  router.navigate({ pathname: "/(tabs)/explore", params: { place: query.trim() } } as Href);
                }}
                style={styles.mapRow}
              >
                <MaterialIcons name="map" size={20} color={C.primary} />
                <Text style={styles.mapRowText} numberOfLines={1}>
                  Find “{query.trim()}” on the rescue map
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={C.soft} />
              </Pressable>
            )}

            {!searching && hub && <HubCard organization={hub} onOpen={() => open(`/organizations/${hub.id}` as Href)} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHead({ title, count, sort, onSort }: { title: string; count: string; sort?: string; onSort?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.countPill}>{count}</Text>
      </View>
      {!!sort && (
        <Pressable accessibilityRole="button" onPress={onSort} style={styles.sort} hitSlop={8}>
          <MaterialIcons name="swap-vert" size={16} color={C.soft} />
          <Text style={styles.sortText}>{sort}</Text>
        </Pressable>
      )}
    </View>
  );
}

function HubCard({ organization, onOpen }: { organization: DirectoryOrganization; onOpen: () => void }) {
  return (
    <View style={styles.hub}>
      <View style={styles.hubLogo}>
        <Text style={styles.hubLogoText}>{initials(organization.name)}</Text>
      </View>
      <View style={styles.hubBody}>
        <Text style={styles.hubName} numberOfLines={1}>
          {organization.name}
        </Text>
        <Text style={styles.hubMeta} numberOfLines={1}>
          {[organization.address || organization.city, organization.is_verified && "Verified Org"].filter(Boolean).join(" • ")}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${organization.name}`} onPress={onOpen} style={styles.hubButton}>
        <Text style={styles.hubButtonText}>View Hub</Text>
      </Pressable>
    </View>
  );
}

const shadow = {
  shadowColor: "#243447",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 10,
  elevation: 2,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  pressed: { transform: [{ scale: 0.99 }] },
  header: {
    height: 68,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248,249,255,0.9)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: { flex: 1, height: 48, paddingLeft: 14, paddingRight: 10, borderRadius: 12, backgroundColor: C.low, flexDirection: "row", alignItems: "center", gap: 8, ...shadow },
  searchInput: { flex: 1, height: "100%", fontFamily: fonts.body, fontSize: 14, color: C.ink },
  clear: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.variant, alignItems: "center", justifyContent: "center" },
  tune: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  strip: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 6, paddingVertical: 2 },
  species: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 6, ...shadow },
  speciesOn: { backgroundColor: C.green },
  speciesText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  speciesTextOn: { color: colors.onPrimary },
  quick: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  quickPlain: { backgroundColor: C.container },
  quickCritical: { backgroundColor: C.pinkBg },
  quickAdopt: { backgroundColor: C.mint },
  quickOn: { backgroundColor: C.green },
  criticalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.error },
  criticalDotOn: { backgroundColor: colors.onPrimary },
  quickText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  quickTextCritical: { color: C.pinkText },
  quickTextAdopt: { color: C.onMintDeep },
  quickTextOn: { color: colors.onPrimary },
  recent: { paddingTop: 2 },
  recentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  recentTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase", color: C.soft },
  clearAll: { fontFamily: fonts.bodyMedium, fontSize: 11, color: C.secondary },
  recentChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recentChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.low },
  recentLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  recentText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.ink },
  state: { paddingVertical: 48, alignItems: "center" },
  stateText: { fontFamily: fonts.body, fontSize: 14, color: C.soft, textAlign: "center" },
  featured: { marginVertical: 4, padding: 12, gap: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow },
  featuredTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  urgent: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.errorBg },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.error },
  urgentText: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, textTransform: "uppercase", color: C.errorText },
  featuredPlace: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  featuredPlaceText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  featuredBody: { flexDirection: "row", alignItems: "center", gap: 12 },
  featuredImage: { width: 96, height: 96, borderRadius: 12, overflow: "hidden", backgroundColor: C.container },
  ageTag: {
    position: "absolute",
    right: 4,
    bottom: 4,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(33,49,68,0.8)",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    color: "#EAF1FF",
  },
  featuredText: { flex: 1, minWidth: 0 },
  featuredNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredName: { flexShrink: 1, fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  featuredMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  needRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  need: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.primary },
  featuredActions: { flexDirection: "row", gap: 8 },
  foster: { flex: 1, height: 48, borderRadius: 999, backgroundColor: C.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  fosterText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
  shareButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.low, alignItems: "center", justifyContent: "center" },
  sectionGap: { marginTop: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: fonts.displaySemiBold, fontSize: 20, lineHeight: 26, color: C.ink },
  countPill: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.mint,
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: C.onMint,
  },
  sort: { flexDirection: "row", alignItems: "center", gap: 2 },
  sortText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: C.soft },
  empty: { paddingVertical: 12, fontFamily: fonts.body, fontSize: 13, color: C.soft },
  row: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", gap: 12, ...shadow },
  rowImage: { width: 84, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  rowBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: C.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: C.onMint,
  },
  rowBadgeCritical: { backgroundColor: C.errorBg, color: C.errorText },
  rowBody: { flex: 1, minWidth: 0, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowName: { flexShrink: 1, fontFamily: fonts.displaySemiBold, fontSize: 17, lineHeight: 22, color: C.ink },
  rowDistance: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  rowBottom: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  infoChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  infoMint: { backgroundColor: C.mint },
  infoBlue: { backgroundColor: C.container },
  infoRed: { backgroundColor: C.errorBg },
  infoText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14 },
  infoTextMint: { color: C.onMintDeep },
  infoTextBlue: { color: C.primary },
  infoTextRed: { color: C.errorText },
  progress: { height: 4, marginTop: 8, borderRadius: 999, overflow: "hidden", backgroundColor: C.container },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: C.primary },
  mapRow: { padding: 14, borderRadius: 14, backgroundColor: C.low, flexDirection: "row", alignItems: "center", gap: 10 },
  mapRowText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.ink },
  hub: { marginTop: 4, padding: 16, borderRadius: 16, backgroundColor: C.low, flexDirection: "row", alignItems: "center", gap: 12 },
  hubLogo: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  hubLogoText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onPrimary },
  hubBody: { flex: 1, minWidth: 0 },
  hubName: { fontFamily: fonts.displaySemiBold, fontSize: 16, lineHeight: 22, color: C.ink },
  hubMeta: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  hubButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface, ...shadow },
  hubButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: C.primary },
});
