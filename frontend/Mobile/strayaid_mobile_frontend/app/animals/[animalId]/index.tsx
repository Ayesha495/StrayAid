import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../hooks/useSession";
import { getAnimal, MobileAnimal } from "../../services/mobileContentService";
import { followAnimal, getFollowStatus, unfollowAnimal } from "../../services/notificationService";
import { colors, fonts } from "../../theme/tokens";

// Stitch screen 13: Animal profile.

const HERO_HEIGHT = 370;
const HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  minor_issues: "Minor issues",
  under_treatment: "Under treatment",
  special_needs: "Special needs",
};
const STATUS_CHIP: Record<string, string> = {
  rescued: "Rescued",
  recovering: "Recovering",
  adoptable: "Rescued",
  adopted: "Adopted",
};

const capitalize = (value?: string) => (value ? value[0].toUpperCase() + value.slice(1) : "");

function ageLabel(age?: number | null) {
  if (age == null) return null;
  if (age < 1) return "Under 1 year";
  return `${age} ${age === 1 ? "year" : "years"} old`;
}

export default function AnimalProfileScreen() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [animal, setAnimal] = useState<MobileAnimal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [page, setPage] = useState(0);
  const [showSponsor, setShowSponsor] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, follow] = await Promise.all([
        getAnimal(animalId),
        getFollowStatus({ animalId: Number(animalId) }).catch(() => ({ followingAnimal: false })),
      ]);
      setAnimal(data);
      setFollowing(!!follow.followingAnimal);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this animal.");
    }
  }, [animalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));

  const toggleFollow = async () => {
    if (!animal) return;
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    const next = !following;
    setFollowing(next);
    try {
      setFollowing(next ? await followAnimal(animal.id) : await unfollowAnimal(animal.id));
    } catch {
      setFollowing(!next);
    }
  };

  const share = () => {
    if (!animal) return;
    Share.share({
      message: `Meet ${animal.name}, a rescued ${animal.species?.toLowerCase() || "animal"} with ${animal.organization.name} on StrayAid.`,
    }).catch(() => null);
  };

  // The adoption form is Stitch 14; until then, people contact the organization directly.
  const adopt = () => {
    if (!animal) return;
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    const info = animal.adoption_info;
    const options = [
      info?.phone && { text: `Call ${info.phone}`, onPress: () => Linking.openURL(`tel:${info.phone}`) },
      info?.email && {
        text: "Send an email",
        onPress: () =>
          Linking.openURL(`mailto:${info.email}?subject=${encodeURIComponent(`Adopting ${animal.name}`)}`),
      },
    ].filter(Boolean) as { text: string; onPress: () => void }[];
    if (!options.length) {
      Alert.alert(`Adopt ${animal.name}`, `${animal.organization.name} hasn't added contact details yet.`);
      return;
    }
    Alert.alert(`Adopt ${animal.name}`, `${info?.message ?? "Contact"} phone or email.`, [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const sponsor = () => {
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    setShowSponsor(true);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));

  if (!animal) {
    return (
      <View style={[styles.screen, styles.centered]}>
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
      </View>
    );
  }

  const photos = animal.photos?.length ? animal.photos : animal.image ? [animal.image] : [];
  const adoptable = animal.status === "adoptable";
  const adopted = animal.status === "adopted";
  const attributes = [
    animal.health && HEALTH_LABELS[animal.health],
    animal.vaccinated && "Vaccinated",
    ageLabel(animal.age),
    capitalize(animal.gender),
  ].filter(Boolean) as string[];
  const place = [animal.organization.city, "Pakistan"].filter(Boolean).join(", ");
  const adoptLabel = adopted ? "Adopted" : adoptable ? `Adopt ${animal.name}` : "In recovery";

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {photos.length ? (
            <FlatList
              data={photos}
              keyExtractor={(uri, index) => `${uri}-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScroll}
              onScroll={onScroll}
              scrollEventThrottle={64}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width, height: HERO_HEIGHT }} contentFit="cover" transition={150} />
              )}
            />
          ) : (
            <View style={[styles.heroEmpty, { width }]}>
              <MaterialIcons name="pets" size={56} color="#CBD5E1" />
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.15)", "transparent"]}
            style={styles.heroShade}
            pointerEvents="none"
          />
          <View style={[styles.heroButtons, { top: insets.top + 8 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBack}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="chevron-left" size={28} color="#374151" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={following ? `Stop following ${animal.name}` : `Follow ${animal.name}`}
              accessibilityState={{ selected: following }}
              onPress={toggleFollow}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <MaterialIcons
                name={following ? "favorite" : "favorite-border"}
                size={22}
                color={following ? "#E5484D" : "#374151"}
              />
            </Pressable>
          </View>
          {photos.length > 1 && (
            <View style={styles.dots} pointerEvents="none">
              {photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={[styles.dot, index === page && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.nameRow}>
            <View style={styles.nameLeft}>
              <Text style={styles.name} accessibilityRole="header">
                {animal.name}
              </Text>
              {animal.ai_verified && (
                <View style={styles.verified} accessible accessibilityLabel="Rescue confirmed by the AI photo check">
                  <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
                </View>
              )}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={share} hitSlop={8} style={styles.share}>
              <Feather name="share-2" size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          <View style={styles.chips}>
            {!!animal.species && <Text style={[styles.chip, styles.chipSpecies]}>{capitalize(animal.species)}</Text>}
            <Text style={[styles.chip, adopted ? styles.chipAdopted : styles.chipStatus]}>
              {STATUS_CHIP[animal.status] ?? capitalize(animal.status)}
            </Text>
            {adoptable && (
              <View style={[styles.chipRow, styles.chipAdoption]}>
                <View style={styles.chipDot} />
                <Text style={styles.chipAdoptionText}>Adoption Available</Text>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${animal.organization.name}, open profile`}
            onPress={() => router.push(`/organizations/${animal.organization.id}` as Href)}
            style={({ pressed }) => [styles.shelter, pressed && styles.shelterPressed]}
          >
            <View style={styles.shelterLeft}>
              <View style={styles.shelterIcon}>
                {animal.organization.image ? (
                  <Image source={{ uri: animal.organization.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <MaterialIcons name="favorite" size={20} color={colors.primary} />
                )}
              </View>
              <View style={styles.shelterText}>
                <Text style={styles.shelterName} numberOfLines={1}>
                  {animal.organization.name}
                </Text>
                <View style={styles.shelterPlace}>
                  <Feather name="map-pin" size={13} color="#9CA3AF" />
                  <Text style={styles.shelterPlaceText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.shelterArrow}>
              <Feather name="chevron-right" size={16} color="#9CA3AF" />
            </View>
          </Pressable>

          {attributes.length > 0 && (
            <View style={styles.attributes}>
              <View style={styles.attributeLead} />
              {attributes.map((attribute, index) => (
                <View key={attribute} style={styles.attributeItem}>
                  {index > 0 && <Text style={styles.attributeSeparator}>•</Text>}
                  <Text style={styles.attributeText}>{attribute}</Text>
                </View>
              ))}
            </View>
          )}

          {(!!animal.description || !!animal.medical_info) && (
            <View style={styles.about}>
              <Text style={styles.aboutTitle}>About {animal.name}</Text>
              {!!animal.description && <Text style={styles.aboutText}>{animal.description}</Text>}
              {!!animal.medical_info && (
                <Text style={[styles.aboutText, styles.aboutHealth]}>
                  <Text style={styles.aboutHealthLabel}>Health: </Text>
                  {animal.medical_info}
                </Text>
              )}
            </View>
          )}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <View style={[styles.statIcon, { backgroundColor: "#FFF1F2" }]}>
                <MaterialIcons name="favorite" size={20} color="#F43F5E" />
              </View>
              <View>
                <Text style={styles.statValue}>{animal.sponsor_count ?? 0}</Text>
                <Text style={styles.statLabel}>{animal.sponsor_count === 1 ? "Sponsor" : "Sponsors"}</Text>
              </View>
            </View>
            <View style={styles.stat}>
              <View style={[styles.statIcon, { backgroundColor: "#ECFDF5" }]}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.statValue}>{animal.application_count ?? 0}</Text>
                <Text style={styles.statLabel}>{animal.application_count === 1 ? "Application" : "Applications"}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !adoptable }}
          disabled={!adoptable}
          onPress={adopt}
          style={({ pressed }) => [styles.adopt, pressed && styles.adoptPressed, !adoptable && styles.adoptDisabled]}
        >
          <Text style={styles.adoptText} numberOfLines={1}>
            {adoptLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: adopted }}
          disabled={adopted}
          onPress={sponsor}
          style={({ pressed }) => [styles.sponsor, pressed && styles.sponsorPressed, adopted && styles.sponsorDisabled]}
        >
          <MaterialIcons name="favorite" size={16} color={colors.primary} />
          <Text style={styles.sponsorText}>Sponsor</Text>
        </Pressable>
      </View>

      <Modal visible={showSponsor} transparent animationType="fade" onRequestClose={() => setShowSponsor(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSponsor(false)}>
          <Pressable style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => null}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sponsor {animal.name}</Text>
            {animal.donation_info ? (
              <>
                <Text style={styles.modalBody}>
                  Transfer any amount to {animal.organization.name}. It goes towards {animal.name}&apos;s food, medical care and
                  shelter.
                </Text>
                <View style={styles.bank}>
                  <Text style={styles.bankLabel}>Bank</Text>
                  <Text style={styles.bankValue} selectable>
                    {animal.donation_info.bank}
                  </Text>
                  <Text style={styles.bankLabel}>Account title</Text>
                  <Text style={styles.bankValue} selectable>
                    {animal.donation_info.account_name}
                  </Text>
                  <Text style={styles.bankLabel}>Account number</Text>
                  <Text style={[styles.bankValue, styles.bankNumber]} selectable>
                    {animal.donation_info.account_number}
                  </Text>
                </View>
                {!!animal.adoption_info?.email && (
                  <Text style={styles.modalNote}>
                    After transferring, email the receipt to {animal.adoption_info.email} so they can confirm your pledge.
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.modalBody}>
                {animal.organization.name} hasn&apos;t added bank details yet. Contact them from their profile to help {animal.name}.
              </Text>
            )}
            <Pressable accessibilityRole="button" onPress={() => setShowSponsor(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FBFA" },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  scroll: { paddingBottom: 112 },
  hero: { height: HERO_HEIGHT, backgroundColor: "#F1F5F9" },
  heroEmpty: { height: HERO_HEIGHT, alignItems: "center", justifyContent: "center" },
  heroShade: { position: "absolute", top: 0, left: 0, right: 0, height: 96 },
  heroButtons: { position: "absolute", left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  dots: { position: "absolute", bottom: 32, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  dotActive: { width: 24, backgroundColor: colors.surface },
  sheet: {
    marginTop: -16,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(2,44,34,0.05)",
    backgroundColor: "#F9FBFA",
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  nameLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  name: { flexShrink: 1, fontFamily: fonts.displayExtraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: "#111827" },
  verified: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  share: { padding: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  chipSpecies: { backgroundColor: "#F3F4F6", color: "#374151" },
  chipStatus: { backgroundColor: "#ECFDF5", color: colors.primary },
  chipAdopted: { backgroundColor: "#F1F5F9", color: "#475569" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  chipAdoption: { backgroundColor: "#DCF2EA" },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#13614C" },
  chipAdoptionText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#13614C" },
  shelter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(243,244,246,0.9)",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shelterPressed: { backgroundColor: "#F9FAFB" },
  shelterLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  shelterIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(30,107,86,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  shelterText: { flex: 1 },
  shelterName: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, color: "#111827" },
  shelterPlace: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  shelterPlaceText: { fontFamily: fonts.body, fontSize: 12, color: "#71827D" },
  shelterArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  attributes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, marginBottom: 16 },
  attributeLead: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 8 },
  attributeItem: { flexDirection: "row", alignItems: "center" },
  attributeSeparator: { marginHorizontal: 8, fontFamily: fonts.bodySemiBold, fontSize: 12, color: "#D1D5DB" },
  attributeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 18, color: "#4B5563" },
  about: { marginBottom: 20 },
  aboutTitle: {
    marginBottom: 6,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#9CA3AF",
  },
  aboutText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: "#4B5563" },
  aboutHealth: { marginTop: 8 },
  aboutHealthLabel: { fontFamily: fonts.bodySemiBold, color: "#374151" },
  stats: { flexDirection: "row", gap: 12, marginBottom: 8 },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: fonts.displayExtraBold, fontSize: 16, lineHeight: 20, color: "#111827" },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, color: "#6B7280" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 8,
  },
  adopt: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  adoptPressed: { backgroundColor: "#165242", transform: [{ scale: 0.98 }] },
  adoptDisabled: { backgroundColor: "#94A3B8", shadowOpacity: 0 },
  adoptText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onPrimary },
  sponsor: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(30,107,86,0.1)",
    backgroundColor: "#EAF3F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sponsorPressed: { backgroundColor: "#DDF0E8", transform: [{ scale: 0.98 }] },
  sponsorDisabled: { opacity: 0.5 },
  sponsorText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primary },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  modalCard: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  modalHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginBottom: 4 },
  modalTitle: { fontFamily: fonts.displayExtraBold, fontSize: 20, color: "#111827" },
  modalBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: "#4B5563" },
  bank: { padding: 14, gap: 2, borderRadius: 16, backgroundColor: "#F8FAF9", borderWidth: 1, borderColor: "#E8ECE9" },
  bankLabel: { marginTop: 6, fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "#94A3B8" },
  bankValue: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: "#111827" },
  bankNumber: { fontFamily: fonts.displayBold, letterSpacing: 1 },
  modalNote: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 18, color: "#64748B" },
  modalClose: {
    height: 50,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
});
