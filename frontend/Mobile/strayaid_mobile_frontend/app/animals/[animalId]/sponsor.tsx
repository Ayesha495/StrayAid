import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import { getAnimal, MobileAnimal, pledgeSupport } from "../../../services/mobileContentService";
import { followAnimal, getFollowStatus, unfollowAnimal } from "../../../services/notificationService";
import { colors, fonts } from "../../../theme/tokens";
import { pickPhoto, PickedPhoto } from "../../../utils/pickPhoto";

// Stitch screen 16: Sponsor an animal. There's no payment gateway (free services only):
// people transfer to the organization's bank account and attach the receipt, and the
// organization confirms the pledge.

const HERO_HEIGHT = 290;
const AMOUNTS = [500, 1000, 2000];
const MIN_AMOUNT = 100;
const STATUS_WORD: Record<string, string> = {
  rescued: "Rescued",
  recovering: "Recovering",
  adoptable: "Ready for adoption",
  adopted: "Adopted",
};
// Colours of the little sponsor avatars, as in the design.
const AVATAR_COLORS = [
  { bg: "#E2E8F0", fg: "#475569" },
  { bg: "#D1FAE5", fg: colors.primary },
  { bg: "#FEF3C7", fg: "#B45309" },
];

const pkr = (value: number) => `PKR ${value.toLocaleString("en-US")}`;

export default function SponsorScreen() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [animal, setAnimal] = useState<MobileAnimal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [amount, setAmount] = useState<number | "custom">(1000);
  const [custom, setCustom] = useState("");
  const [monthly, setMonthly] = useState(true);
  const [sheet, setSheet] = useState<"closed" | "transfer" | "sent">("closed");
  const [receipt, setReceipt] = useState<PickedPhoto | null>(null);
  const [sending, setSending] = useState(false);

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

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/animals/${animalId}` as Href));

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

  const organization = animal.organization;
  const sponsors = animal.sponsor_count ?? 0;
  const goal = Math.max(animal.sponsor_goal ?? 0, 1);
  const needed = Math.max(goal - sponsors, 0);
  const chosen = amount === "custom" ? Number(custom.replace(/[^0-9]/g, "")) || 0 : amount;
  const adopted = animal.status === "adopted";
  const pending = animal.my_sponsorship?.status === "pending";
  const place = [organization.city, "Pakistan"].filter(Boolean).join(", ");
  const supports =
    animal.health === "under_treatment" || animal.status === "recovering"
      ? "Supports medical care, food and shelter"
      : "Supports food, medical care and shelter";
  const photo = animal.image ?? animal.photos?.[0] ?? null;

  const toggleFollow = async () => {
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

  const share = () =>
    Share.share({
      message: `Help ${animal.name}, a rescued ${animal.species?.toLowerCase() || "animal"} cared for by ${organization.name}. Sponsor on StrayAid.`,
    }).catch(() => null);

  const startPledge = () => {
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    if (chosen < MIN_AMOUNT) {
      Alert.alert("Choose an amount", `The smallest pledge is ${pkr(MIN_AMOUNT)}.`);
      return;
    }
    if (!animal.donation_info?.account_number) {
      Alert.alert(organization.name, `${organization.name} hasn't added bank details yet. Message them to help ${animal.name}.`);
      return;
    }
    setReceipt(null);
    setSheet("transfer");
  };

  const attachReceipt = () =>
    Alert.alert("Attach your receipt", "A screenshot or photo of the bank transfer.", [
      { text: "Choose from gallery", onPress: async () => setReceipt((await pickPhoto("library", "attach the receipt")) ?? receipt) },
      { text: "Take a photo", onPress: async () => setReceipt((await pickPhoto("camera", "attach the receipt")) ?? receipt) },
      { text: "Cancel", style: "cancel" },
    ]);

  const send = async () => {
    if (!receipt) {
      attachReceipt();
      return;
    }
    setSending(true);
    try {
      await pledgeSupport(animal.id, { amount: chosen, monthly, receipt });
      setSheet("sent");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setSheet("closed");
        router.push("/auth-sheet");
      } else {
        Alert.alert("Couldn't send your pledge", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  const footerLabel = adopted ? `${animal.name} has been adopted` : pending ? "Pledge being checked" : "Pledge Support";

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {photo ? (
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <MaterialIcons name="pets" size={56} color="#CBD5E1" />
            )}
            <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent"]} style={styles.heroShade} pointerEvents="none" />
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <View style={styles.nameLeft}>
                <Text style={styles.name} accessibilityRole="header">
                  {animal.name}
                </Text>
                {animal.ai_verified && (
                  <View style={styles.paw} accessible accessibilityLabel="Verified rescue animal">
                    <MaterialIcons name="pets" size={13} color={colors.primary} />
                  </View>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={share} hitSlop={8} style={styles.quickShare}>
                <Feather name="share" size={18} color="#94A3B8" />
              </Pressable>
            </View>
            <Text style={styles.kind}>
              {animal.species || "Animal"}
              <Text style={styles.kindDot}>{"  •  "}</Text>
              <Text style={styles.kindStatus}>{STATUS_WORD[animal.status] ?? animal.status}</Text>
            </Text>

            <View style={styles.where}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${organization.name}, open profile`}
                onPress={() => router.push(`/organizations/${organization.id}` as Href)}
                style={styles.whereRow}
              >
                <MaterialIcons name="home" size={15} color={colors.primary} />
                <Text style={styles.whereOrg}>{organization.name}</Text>
              </Pressable>
              <View style={styles.whereRow}>
                <Feather name="map-pin" size={13} color="#94A3B8" />
                <Text style={styles.wherePlace}>{place}</Text>
              </View>
            </View>

            <View style={styles.countRow}>
              <View style={styles.countLeft}>
                {!!animal.sponsor_initials?.length && (
                  <View style={styles.avatars}>
                    {animal.sponsor_initials.map((initials, index) => (
                      <View
                        key={initials}
                        style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index].bg, marginLeft: index ? -6 : 0 }]}
                      >
                        <Text style={[styles.avatarText, { color: AVATAR_COLORS[index].fg }]}>{initials}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.countLabel}>Sponsor count:</Text>
                <Text style={styles.countValue}>{sponsors}</Text>
              </View>
              <Text style={styles.need}>{needed > 0 ? "Ongoing Need" : "Goal reached"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {animal.my_sponsorship && (
            <View style={styles.mine}>
              <MaterialIcons name={pending ? "hourglass-top" : "favorite"} size={16} color={colors.primary} />
              <Text style={styles.mineText}>
                {pending
                  ? `Your ${pkr(animal.my_sponsorship.amount_pkr)} pledge is with ${organization.name} to check the receipt.`
                  : `You sponsor ${animal.name}: ${pkr(animal.my_sponsorship.amount_pkr)}${
                      animal.my_sponsorship.monthly ? " a month" : ""
                    }. Thank you!`}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose amount</Text>
            <View style={styles.amounts}>
              {AMOUNTS.map((value) => (
                <AmountButton
                  key={value}
                  selected={amount === value}
                  top="PKR"
                  bottom={value.toLocaleString("en-US")}
                  onPress={() => setAmount(value)}
                  label={pkr(value)}
                />
              ))}
              <AmountButton
                selected={amount === "custom"}
                top="Flex"
                bottom="Custom"
                custom
                onPress={() => setAmount("custom")}
                label="Custom amount"
              />
            </View>
            {amount === "custom" && (
              <View style={styles.customRow}>
                <Text style={styles.customPrefix}>PKR</Text>
                <TextInput
                  value={custom}
                  onChangeText={(text) => setCustom(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="Enter an amount"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  autoFocus
                  style={styles.customInput}
                  accessibilityLabel="Custom amount in rupees"
                />
              </View>
            )}
            <View style={styles.supports}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={styles.supportsText}>{supports}</Text>
            </View>
          </View>

          <View style={styles.tracker}>
            <View style={styles.trackerTop}>
              <Text style={styles.trackerTitle}>Pledged support</Text>
              <Text style={styles.trackerRatio}>
                {sponsors} / {goal}
              </Text>
            </View>
            <View
              style={styles.bar}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${sponsors} of ${goal} sponsors`}
              accessibilityValue={{ min: 0, max: goal, now: Math.min(sponsors, goal) }}
            >
              <View style={[styles.barFill, { width: `${Math.min(100, (sponsors / goal) * 100)}%` }]} />
            </View>
            <View style={styles.trackerBottom}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: monthly }}
                accessibilityLabel="Monthly pledge"
                accessibilityHint="Switches between a monthly pledge and a one-time gift"
                onPress={() => setMonthly((value) => !value)}
                hitSlop={8}
                style={styles.monthly}
              >
                <MaterialCommunityIcons name={monthly ? "clock-time-four" : "gift"} size={13} color={colors.primary} />
                <Text style={styles.monthlyText}>{monthly ? "Monthly pledge" : "One-time gift"}</Text>
                <Feather name="repeat" size={10} color={colors.primary} style={styles.monthlySwap} />
              </Pressable>
              <Text style={styles.needed}>
                {needed > 0 ? `${needed} ${needed === 1 ? "sponsor" : "sponsors"} needed to reach goal` : "Thank you, sponsors!"}
              </Text>
            </View>
          </View>

          <View style={styles.partnerWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/organizations/${organization.id}` as Href)}
              style={({ pressed }) => [styles.partner, pressed && styles.partnerPressed]}
            >
              <View style={styles.partnerLeft}>
                <View style={styles.partnerIcon}>
                  <Text style={styles.partnerEmoji}>🐾</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.partnerTitle}>{organization.is_verified ? "Verified NGO Partner" : organization.name}</Text>
                  <Text style={styles.partnerSub}>
                    {organization.is_verified ? "100% of funds go toward animal care" : `Funds go straight to ${organization.name}`}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.nav, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={22} color={colors.onPrimary} />
        </Pressable>
        <View style={styles.navRight}>
          <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={share} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
            <Feather name="share-2" size={18} color={colors.onPrimary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={following ? `Stop following ${animal.name}` : `Follow ${animal.name}`}
            accessibilityState={{ selected: following }}
            onPress={toggleFollow}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <MaterialIcons name={following ? "favorite" : "favorite-border"} size={20} color={following ? "#FF6B6B" : colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: adopted || pending }}
          disabled={adopted || pending}
          onPress={startPledge}
          style={({ pressed }) => [styles.pledge, pressed && styles.pledgePressed, (adopted || pending) && styles.pledgeDisabled]}
        >
          <MaterialIcons name="favorite" size={18} color={colors.onPrimary} />
          <Text style={styles.pledgeText}>{footerLabel}</Text>
        </Pressable>
      </View>

      <Modal visible={sheet !== "closed"} transparent animationType="fade" onRequestClose={() => setSheet("closed")}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={() => !sending && setSheet("closed")}>
          <Pressable accessible={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => null}>
            <View style={styles.handle} />
            {sheet === "sent" ? (
              <View style={styles.sent}>
                <View style={styles.sentIcon}>
                  <MaterialIcons name="favorite" size={30} color={colors.primary} />
                </View>
                <Text style={styles.sheetTitle}>Thank you for supporting {animal.name}!</Text>
                <Text style={styles.sheetBody}>
                  {organization.name} will check your receipt and confirm your {pkr(chosen)}
                  {monthly ? " monthly" : ""} pledge. We&apos;ll send you a notification when it&apos;s confirmed.
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setSheet("closed")} style={styles.sheetButton}>
                  <Text style={styles.sheetButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.sheetTitle}>
                  Transfer {pkr(chosen)}
                  {monthly ? " a month" : ""}
                </Text>
                <Text style={styles.sheetBody}>
                  Send it to {organization.name}&apos;s account below, then attach the receipt so they can confirm your pledge.
                  {monthly ? " For a monthly pledge, transfer the same amount each month." : ""}
                </Text>
                {animal.donation_info && (
                  <View style={styles.bank}>
                    <BankRow label="Bank" value={animal.donation_info.bank} />
                    <BankRow label="Account title" value={animal.donation_info.account_name} />
                    <BankRow label="Account number" value={animal.donation_info.account_number} big />
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={receipt ? "Change the receipt" : "Attach the receipt"}
                  onPress={attachReceipt}
                  style={({ pressed }) => [styles.receipt, receipt && styles.receiptDone, pressed && styles.partnerPressed]}
                >
                  {receipt ? (
                    <Image source={{ uri: receipt.uri }} style={styles.receiptThumb} contentFit="cover" />
                  ) : (
                    <View style={styles.receiptIcon}>
                      <Feather name="upload" size={18} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.receiptTitle}>{receipt ? "Receipt attached" : "Attach receipt"}</Text>
                    <Text style={styles.receiptSub}>{receipt ? "Tap to change it" : "Screenshot or photo of the transfer"}</Text>
                  </View>
                  {receipt && <Feather name="check-circle" size={18} color={colors.primary} />}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={sending}
                  onPress={send}
                  style={({ pressed }) => [styles.sheetButton, pressed && styles.pledgePressed, !receipt && styles.sheetButtonSoft]}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.sheetButtonText}>{receipt ? "Send pledge" : "Attach receipt to continue"}</Text>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function AmountButton({
  selected,
  top,
  bottom,
  custom,
  label,
  onPress,
}: {
  selected: boolean;
  top: string;
  bottom: string;
  custom?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.amountRing, selected && styles.amountRingOn]}
    >
      <View style={[styles.amount, selected && styles.amountOn]}>
        <Text style={[styles.amountTop, !custom && styles.amountTopUpper, selected && styles.amountTopOn]}>{top}</Text>
        <Text style={[styles.amountValue, custom && styles.amountCustom, selected && styles.amountValueOn]}>{bottom}</Text>
      </View>
    </Pressable>
  );
}

function BankRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.bankRow}>
      <Text style={styles.bankLabel}>{label}</Text>
      <Text style={[styles.bankValue, big && styles.bankNumber]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  scroll: { paddingBottom: 110 },
  hero: { height: HERO_HEIGHT, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  heroShade: { position: "absolute", top: 0, left: 0, right: 0, height: 96 },
  nav: { position: "absolute", left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" },
  navRight: { flexDirection: "row", gap: 10 },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  pressed: { transform: [{ scale: 0.95 }] },
  info: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nameLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  name: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: "#111827" },
  paw: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  quickShare: { padding: 4 },
  kind: { marginTop: 2, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.3, color: "#6B7280" },
  kindDot: { color: "#6B7280" },
  kindStatus: { fontFamily: fonts.bodyMedium, color: colors.primary },
  where: { marginTop: 10, gap: 4 },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  whereOrg: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#334155" },
  wherePlace: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#64748B" },
  countRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatars: { flexDirection: "row", marginRight: 4 },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 7.5 },
  countLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#64748B" },
  countValue: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#111827" },
  need: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E8F3EF",
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 16,
    color: colors.primary,
  },
  divider: {
    height: 6,
    marginVertical: 4,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(241,245,249,0.7)",
  },
  mine: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.mint,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mineText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 18, color: colors.primary },
  section: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#111827" },
  amounts: { flexDirection: "row", gap: 8, marginTop: 12 },
  amountRing: { flex: 1, padding: 1, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  amountRingOn: { borderColor: colors.primary },
  amount: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  amountOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  amountTop: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: "#64748B" },
  amountTopUpper: { textTransform: "uppercase", letterSpacing: 0.55 },
  amountTopOn: { fontFamily: fonts.bodySemiBold, color: "#D1FAE5" },
  amountValue: { marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: "#1E293B" },
  amountCustom: { color: "#334155" },
  amountValueOn: { color: colors.onPrimary },
  customRow: {
    marginTop: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customPrefix: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#64748B" },
  customInput: { flex: 1, height: "100%", fontFamily: fonts.bodyBold, fontSize: 15, color: "#111827" },
  supports: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "rgba(248,250,252,0.8)",
  },
  supportsText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: "#475569" },
  tracker: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  trackerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  trackerTitle: { fontFamily: fonts.displayBold, fontSize: 12, lineHeight: 16, color: "#111827" },
  trackerRatio: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontWeight: "700",
    fontSize: 12,
    color: "#334155",
  },
  bar: {
    height: 10,
    padding: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.5)",
    backgroundColor: "#F1F5F9",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
  trackerBottom: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthly: { flexDirection: "row", alignItems: "center", gap: 4 },
  monthlyText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: colors.primary },
  monthlySwap: { marginLeft: 2, opacity: 0.7 },
  needed: { flexShrink: 1, textAlign: "right", fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: "#64748B" },
  partnerWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  partner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FBFDFC",
  },
  partnerPressed: { backgroundColor: "#F1F5F4" },
  partnerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  partnerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(30,107,86,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerEmoji: { fontSize: 13 },
  partnerTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#111827" },
  partnerSub: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: "#64748B" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.8)",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 8,
  },
  pledge: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  pledgePressed: { backgroundColor: "#165242", transform: [{ scale: 0.99 }] },
  pledgeDisabled: { backgroundColor: "#94A3B8", shadowOpacity: 0 },
  pledgeText: { fontFamily: fonts.displaySemiBold, fontSize: 14, letterSpacing: 0.35, color: colors.onPrimary },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.displayExtraBold, fontSize: 20, lineHeight: 26, color: "#111827" },
  sheetBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: "#4B5563" },
  bank: { padding: 14, gap: 8, borderRadius: 16, backgroundColor: "#F8FAF9", borderWidth: 1, borderColor: "#E8ECE9" },
  bankRow: { gap: 2 },
  bankLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: "#64748B" },
  bankValue: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: "#111827" },
  bankNumber: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: 1 },
  receipt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(30,107,86,0.35)",
    backgroundColor: "#FBFDFC",
  },
  receiptDone: { borderStyle: "solid", borderColor: "rgba(30,107,86,0.2)" },
  receiptIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  receiptThumb: { width: 44, height: 44, borderRadius: 12 },
  receiptTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#111827" },
  receiptSub: { fontFamily: fonts.body, fontSize: 12, color: "#64748B" },
  sheetButton: {
    height: 50,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetButtonSoft: { backgroundColor: "#4D8C7A" },
  sheetButtonText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
  sent: { alignItems: "center", gap: 12, paddingTop: 8 },
  sentIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
