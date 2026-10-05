import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RescueMap, { RescueMapHandle, RescueMapMessage } from "../../../components/map/RescueMap";
import type { MapCase } from "../../../components/map/rescueMapHtml";
import { getMapCases, TrendingCase } from "../../../services/homeService";
import { findAddress, getCurrentLocation, hasLocationPermission } from "../../../services/locationService";
import type { LatLng } from "../../../services/reportDraft";
import { colors, fonts } from "../../../theme/tokens";
import { distanceKm, formatDistance } from "../../../utils/format";

// Stitch screen 12: Rescue map (the Explore tab). Open cases as pins coloured by severity,
// a search box, severity filters and the selected case as a card above the tab bar.

type Filter = "all" | "high" | "medium" | "low";

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High", dot: colors.critical },
  { value: "medium", label: "Medium", dot: "#F4B360" },
  { value: "low", label: "Low", dot: colors.secondary },
];

const SEVERITY_CHIP = {
  critical: { label: "Critical", color: "#B42318", background: "#FDECEC" },
  high: { label: "High", color: colors.critical, background: "#FDECE9" },
  medium: { label: "Medium", color: "#B7791F", background: "#FEF6EC" },
  low: { label: "Low", color: "#1E8A66", background: "#E8F7F2" },
};

// Islamabad, until we know where the person is.
const FALLBACK = { lat: 33.6844, lng: 73.0479 };
// The map opens framing the person and the open cases within this distance.
const FRAME_KM = 5;

const matchesFilter = (item: TrendingCase, filter: Filter) =>
  filter === "all" || item.severity === filter || (filter === "high" && item.severity === "critical");

const matchesQuery = (item: TrendingCase, query: string) => {
  const text = query.trim().toLowerCase();
  return !text || [item.title, item.area, item.species].some((value) => value?.toLowerCase().includes(text));
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<RescueMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cases, setCases] = useState<TrendingCase[]>([]);
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
    () => cases.filter((item) => matchesFilter(item, filter) && matchesQuery(item, query)),
    [cases, filter, query]
  );
  // The most urgent visible case is shown until the person picks another pin.
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

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

  const onMapMessage = (message: RescueMapMessage) => {
    if (message.type === "ready") setMapReady(true);
    if (message.type === "select") setSelectedId(message.id);
  };

  const choose = (item: TrendingCase) => {
    setSelectedId(item.id);
    map.current?.post({ type: "select", id: item.id, pan: true });
  };

  const recenter = async () => {
    setLocating(true);
    setNotice(null);
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

  // Matching cases are filtered as you type; if none match, the text is treated as a place.
  const search = async () => {
    Keyboard.dismiss();
    setNotice(null);
    const text = query.trim();
    if (!text) return;
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

  const distance = selected && me ? formatDistance(distanceKm(me, selected)) : null;
  const chip = selected ? SEVERITY_CHIP[selected.severity] ?? SEVERITY_CHIP.medium : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <RescueMap ref={map} initialCenter={FALLBACK} onMessage={onMapMessage} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.search}>
          <Feather name="search" size={19} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setNotice(null);
            }}
            onSubmitEditing={search}
            placeholder="Search nearby cases"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search nearby cases or a place"
          />
          {!!query && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={8}>
              <MaterialIcons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          )}
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
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.title}. Open case`}
              onPress={() => router.push(`/cases/${selected.id}` as Href)}
              style={styles.cardRow}
            >
              <View style={styles.thumb}>
                {selected.image ? (
                  <Image source={{ uri: selected.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                ) : (
                  <MaterialIcons name="pets" size={28} color="#CBD5E1" />
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {selected.title}
                  </Text>
                  <Feather name="chevron-right" size={17} color="#9CA3AF" />
                </View>
                <View style={styles.cardChips}>
                  <View style={[styles.chip, { backgroundColor: chip.background }]}>
                    <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
                    <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
                  </View>
                  {selected.confidence_score != null && (
                    <View style={[styles.chip, { backgroundColor: "#EBF7F2" }]}>
                      <Text style={[styles.chipText, { color: colors.primary }]}>{selected.confidence_score}% confidence</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardMeta}>
                  <Feather name="map-pin" size={13} color="#9CA3AF" />
                  <Text style={styles.cardMetaText} numberOfLines={1}>
                    {distance ? `${distance} away` : selected.area || selected.status_label}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/cases/${selected.id}` as Href)}
              style={({ pressed }) => [styles.viewCase, pressed && styles.viewCasePressed]}
            >
              <Text style={styles.viewCaseText}>View Case</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
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
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 12 },
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
  cardMetaText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 11.5, color: "#767C86" },
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
  emptyText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
});
