import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import VerifyCasePanel from "../../../components/case/VerifyCasePanel";
import RescueMap, { RescueMapHandle, RescueMapMessage } from "../../../components/map/RescueMap";
import type { MapCase } from "../../../components/map/rescueMapHtml";
import type { VerifyResult } from "../../../services/caseService";
import { getMapCases, searchCases, TrendingCase } from "../../../services/homeService";
import { findAddress, getCurrentLocation, hasLocationPermission } from "../../../services/locationService";
import type { LatLng } from "../../../services/reportDraft";
import { colors, fonts } from "../../../theme/tokens";
import { distanceKm, formatDistance } from "../../../utils/format";

// Stitch screen 12: Rescue map (the Explore tab). Open cases as pins coloured by severity,
// a search box, filters and the selected case as a card above the tab bar. The card asks
// "Is this animal still there?" so people nearby can verify reports, like confirming a
// road blockage on a map; their answers feed the case's confidence score.

type Filter = "all" | "unverified" | "verified" | "urgent";

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "all", label: "All" },
  { value: "unverified", label: "Needs verification", dot: colors.info },
  { value: "verified", label: "Verified", dot: colors.secondary },
  { value: "urgent", label: "Urgent", dot: colors.critical },
];

const SEVERITY_CHIP = {
  critical: { label: "Critical", color: "#B42318", background: "#FDECEC" },
  high: { label: "High", color: colors.critical, background: "#FDECE9" },
  medium: { label: "Medium", color: "#8A5A12", background: "#FEF6EC" },
  low: { label: "Low", color: "#1A7558", background: "#E8F7F2" },
};

// Islamabad, until we know where the person is.
const FALLBACK = { lat: 33.6844, lng: 73.0479 };
// The map opens framing the person and the open cases within this distance.
const FRAME_KM = 5;
// The cards under the map: one fills the screen, with a sliver of the next showing.
const CARD_SIDE_SPACE = 48;
const CARD_GAP = 10;

const matchesFilter = (item: TrendingCase, filter: Filter) => {
  const verification = item.verification?.status ?? "unverified";
  if (filter === "unverified") return verification === "unverified" || verification === "mixed";
  if (filter === "verified") return verification === "verified";
  if (filter === "urgent") return item.severity === "high" || item.severity === "critical";
  return true;
};

const matchesQuery = (item: TrendingCase, query: string) => {
  const text = query.trim().toLowerCase();
  return !text || [item.title, item.area, item.species].some((value) => value?.toLowerCase().includes(text));
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - CARD_SIDE_SPACE;
  const carousel = useRef<FlatList<TrendingCase>>(null);
  // "Find … on the rescue map" from the Search screen.
  const { place } = useLocalSearchParams<{ place?: string }>();
  const map = useRef<RescueMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cases, setCases] = useState<TrendingCase[]>([]);
  // Server results for a search: any case anywhere, shown instead of the nearby ones.
  const [results, setResults] = useState<TrendingCase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const searchCenter = useRef<LatLng | null>(null);

  const load = useCallback(async (near?: LatLng | null) => {
    try {
      setCases(await getMapCases(near ?? undefined));
      setError(null);
    } catch {
      setError("We couldn't load rescue cases. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Where the person is, if they already allowed location; otherwise every open case.
  useEffect(() => {
    hasLocationPermission().then(async (granted) => {
      if (!granted) return;
      try {
        setMe(await getCurrentLocation());
      } catch {
        // Fine: the map just starts on the cases instead.
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(searchCenter.current ?? me);
    }, [load, me])
  );

  const visible = useMemo(
    () => (results ?? cases).filter((item) => matchesFilter(item, filter) && (!!results || matchesQuery(item, query))),
    [cases, results, filter, query]
  );
  // The most urgent visible case is shown until the person picks another pin.
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const selectedIndex = selected ? visible.indexOf(selected) : -1;

  // A pin tapped on the map brings its card into view.
  useEffect(() => {
    if (selectedIndex >= 0) carousel.current?.scrollToOffset({ offset: selectedIndex * (cardWidth + CARD_GAP), animated: true });
  }, [selectedIndex, cardWidth]);

  // Keep the map in step with the list.
  useEffect(() => {
    if (!mapReady) return;
    const pins: MapCase[] = visible.map((item) => ({
      id: item.id,
      lat: item.latitude,
      lng: item.longitude,
      severity: item.severity,
    }));
    map.current?.post({ type: "cases", cases: pins, selectedId: selected?.id ?? null });
  }, [mapReady, visible, selected?.id]);

  useEffect(() => {
    if (mapReady && me) map.current?.post({ type: "user", lat: me.latitude, lng: me.longitude });
  }, [mapReady, me]);

  // A place picked on the Search screen ("Find … on the rescue map"), once per place.
  const searchedPlace = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || loading || !place || searchedPlace.current === place) return;
    searchedPlace.current = place;
    setQuery(place);
    search(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, loading, place]);

  // First time there's something to show, frame the person and the nearest few cases.
  const framed = useRef(false);
  useEffect(() => {
    if (!mapReady || framed.current || loading) return;
    const origin = me ?? (cases[0] && { latitude: cases[0].latitude, longitude: cases[0].longitude });
    if (!origin) return;
    framed.current = true;
    // Only cases close by: one far-away case shouldn't zoom the whole map out.
    const nearest = cases
      .filter((item) => distanceKm(origin, item) <= FRAME_KM)
      .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
      .slice(0, 6);
    if (!nearest.length) {
      map.current?.post({ type: "center", lat: origin.latitude, lng: origin.longitude, zoom: 14 });
      return;
    }
    const points = [origin, ...nearest].map((point) => ({ lat: point.latitude, lng: point.longitude }));
    map.current?.post({ type: "fit", points, top: insets.top + 150, bottom: 250 });
  }, [mapReady, me, cases, loading, insets.top]);

  // A verification answer changes the case's score, severity and tally: update it in place.
  const onVerified = (caseId: number, result: VerifyResult) =>
  {
    const update = (current: TrendingCase[]) =>
      current.map((item) =>
        item.id === caseId
          ? {
              ...item,
              verification: result.verification,
              confidence_score: result.confidence_score,
              possibly_invalid: result.possibly_invalid,
              severity: result.severity,
            }
          : item
      );
    setCases(update);
    setResults((current) => current && update(current));
  };

  const onMapMessage = (message: RescueMapMessage) => {
    if (message.type === "ready") setMapReady(true);
    if (message.type === "select") setSelectedId(message.id);
  };

  const choose = (item: TrendingCase) => {
    setSelectedId(item.id);
    map.current?.post({ type: "select", id: item.id, pan: true });
  };

  // Swiping the cards moves the map to the case now in front.
  const onSwiped = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const item = visible[Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP))];
    if (item && item.id !== selected?.id) choose(item);
  };

  const recenter = async () => {
    setLocating(true);
    setNotice(null);
    setResults(null);
    try {
      const location = await getCurrentLocation();
      setMe(location);
      searchCenter.current = null;
      map.current?.post({ type: "center", lat: location.latitude, lng: location.longitude, zoom: 15 });
      load(location);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "We couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  // Cases are searched everywhere by address, animal or reference; if none match, the text is
  // treated as a place to move the map to.
  const search = async (typed?: string) => {
    Keyboard.dismiss();
    setNotice(null);
    const text = (typed ?? query).trim();
    if (!text) return;
    try {
      const found = (await searchCases(text)).filter((item) => matchesFilter(item, filter));
      if (found.length) {
        setResults(found);
        setSelectedId(found[0].id);
        map.current?.post({ type: "fit", points: found.map((item) => ({ lat: item.latitude, lng: item.longitude })), top: insets.top + 150, bottom: 250 });
        setNotice(`${found.length} ${found.length === 1 ? "case" : "cases"} found for "${text}".`);
        return;
      }
    } catch {
      // No connection to search with: what's already on the map is still filtered below.
    }
    const matches = cases.filter((item) => matchesFilter(item, filter) && matchesQuery(item, text));
    if (matches.length) {
      choose(matches[0]);
      return;
    }
    try {
      const place = await findAddress(text);
      searchCenter.current = place;
      setQuery("");
      map.current?.post({ type: "center", lat: place.latitude, lng: place.longitude, zoom: 14 });
      await load(place);
      setNotice(`Showing cases near "${text}".`);
    } catch {
      setNotice(`No cases or places match "${text}".`);
    }
  };

  const chip = selected ? SEVERITY_CHIP[selected.severity] ?? SEVERITY_CHIP.medium : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <RescueMap ref={map} initialCenter={FALLBACK} onMessage={onMapMessage} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.searchRow}>
        <View style={[styles.search, styles.searchFlex]}>
          <Feather name="search" size={19} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setResults(null);
              setNotice(null);
            }}
            onSubmitEditing={() => search()}
            placeholder="Search an address or case"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search cases by address, or a place"
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                setQuery("");
                setResults(null);
                setNotice(null);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search animals, cases and shelters"
            onPress={() => router.push("/search" as Href)}
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="manage-search" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          keyboardShouldPersistTaps="handled"
        >
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(option.value)}
                style={[styles.filter, active ? styles.filterActive : styles.filterIdle]}
              >
                {option.dot && !active && <View style={[styles.filterDot, { backgroundColor: option.dot }]} />}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sideRow} pointerEvents="box-none">
          {notice ? <Text style={styles.notice}>{notice}</Text> : <View />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show my location"
            onPress={recenter}
            style={({ pressed }) => [styles.recenter, pressed && styles.pressed]}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <MaterialIcons name="my-location" size={20} color={colors.ink} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {selected && chip ? (
          <>
            {visible.length > 1 && (
              <Text style={styles.position} accessibilityLiveRegion="polite">
                {selectedIndex + 1} of {visible.length} • Swipe for more
              </Text>
            )}
            <FlatList
              ref={carousel}
              horizontal
              data={visible}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth + CARD_GAP}
              decelerationRate="fast"
              disableIntervalMomentum
              onMomentumScrollEnd={onSwiped}
              getItemLayout={(_, index) => ({ length: cardWidth + CARD_GAP, offset: (cardWidth + CARD_GAP) * index, index })}
              initialNumToRender={3}
              windowSize={3}
              contentContainerStyle={styles.cards}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const itemChip = SEVERITY_CHIP[item.severity] ?? SEVERITY_CHIP.medium;
                const away = me ? formatDistance(distanceKm(me, item)) : null;
                return (
                  <View style={[styles.card, { width: cardWidth, marginRight: CARD_GAP }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}. Open case`}
                      onPress={() => router.push(`/cases/${item.id}` as Href)}
                      style={styles.cardRow}
                    >
                      <View style={styles.thumb}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                        ) : (
                          <MaterialIcons name="pets" size={28} color="#CBD5E1" />
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Feather name="chevron-right" size={17} color="#9CA3AF" />
                        </View>
                        <View style={styles.cardChips}>
                          <View style={[styles.chip, { backgroundColor: itemChip.background }]}>
                            <View style={[styles.chipDot, { backgroundColor: itemChip.color }]} />
                            <Text style={[styles.chipText, { color: itemChip.color }]}>{itemChip.label}</Text>
                          </View>
                          {item.confidence_score != null && (
                            <View style={[styles.chip, { backgroundColor: "#EBF7F2" }]}>
                              <Text style={[styles.chipText, { color: colors.primary }]}>{item.confidence_score}% confidence</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.cardMeta}>
                          <Feather name="map-pin" size={13} color="#9CA3AF" />
                          <Text style={styles.cardMetaText} numberOfLines={1}>
                            {[item.area || item.status_label, away && `${away} away`].filter(Boolean).join(" • ")}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    {item.verification && (
                      <VerifyCasePanel
                        compact
                        caseId={item.id}
                        verification={item.verification}
                        onVerified={(result) => onVerified(item.id, result)}
                      />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View case: ${item.title}`}
                      onPress={() => router.push(`/cases/${item.id}` as Href)}
                      style={({ pressed }) => [styles.viewCase, pressed && styles.viewCasePressed]}
                    >
                      <Text style={styles.viewCaseText}>View Case</Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          </>
        ) : (
          <View style={[styles.card, styles.emptyCard, styles.emptySpace]}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <MaterialIcons name={error ? "cloud-off" : "pets"} size={22} color={colors.primary} />
                <Text style={styles.emptyText}>
                  {error ?? (query || filter !== "all" ? "No cases match. Try another search or filter." : "No open rescue cases here right now.")}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#EBF1E9" },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchFlex: { flex: 1 },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 6,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 6,
  },
  searchInput: { flex: 1, height: "100%", fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  filters: { gap: 6, paddingVertical: 2 },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  filterIdle: { paddingHorizontal: 12, borderWidth: 1, borderColor: "#F3F4F6", backgroundColor: colors.surface },
  filterActive: { paddingHorizontal: 16, backgroundColor: colors.primary },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#374151" },
  filterTextActive: { color: colors.onPrimary },
  sideRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  notice: {
    flexShrink: 1,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  recenter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: { opacity: 0.8 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: 12 },
  cards: { paddingHorizontal: 16, alignItems: "flex-end" },
  position: {
    alignSelf: "center",
    overflow: "hidden",
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink,
  },
  card: {
    padding: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0, paddingTop: 2, paddingRight: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 15, lineHeight: 20, letterSpacing: -0.3, color: colors.ink },
  cardChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 10.5, lineHeight: 15, letterSpacing: -0.2 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  cardMetaText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: "#6B7079" },
  viewCase: {
    marginTop: 14,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  viewCasePressed: { backgroundColor: "#165242", transform: [{ scale: 0.99 }] },
  viewCaseText: { fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 0.35, color: colors.onPrimary },
  emptyCard: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64 },
  emptySpace: { marginHorizontal: 16 },
  emptyText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
});
