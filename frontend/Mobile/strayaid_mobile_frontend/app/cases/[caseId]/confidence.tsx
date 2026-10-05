import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import { AIFeedbackReason, CaseDetail, getCase, sendAIFeedback } from "../../../services/caseService";
import type { Severity } from "../../../services/reportDraft";
import { colors, fonts } from "../../../theme/tokens";

// Stitch screen 11: Animal detection confidence. Explains a case's AI score using the same
// formula as the backend (rescue/utils/scoring.py):
// (50% photos + 30% reported severity + 20% number of reports) x response-time factor.

const RING = 176;
const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TIERS = [
  { min: 70, label: "High confidence", color: colors.secondary, ring: colors.primary },
  { min: 40, label: "Medium confidence", color: "#C98A2E", ring: colors.warning },
  { min: 0, label: "Low confidence", color: colors.critical, ring: colors.critical },
];

const SEVERITY: Record<Severity, { label: string; color: string; background: string; border: string }> = {
  low: { label: "Low Severity", color: "#1E8A66", background: "#E8F7F2", border: "rgba(53,169,130,0.25)" },
  medium: { label: "Medium Severity", color: "#B7791F", background: "#FEF7ED", border: "rgba(244,184,96,0.3)" },
  high: { label: "High Severity", color: "#DC2626", background: "#FEF1F0", border: "rgba(244,124,108,0.2)" },
  critical: { label: "Critical Severity", color: "#B42318", background: "#FDECEC", border: "rgba(180,35,24,0.25)" },
};

// "Visual Canine Identification", as in the design.
const ANIMAL_WORD: Record<string, string> = {
  dog: "Canine",
  cat: "Feline",
  bird: "Avian",
  horse: "Equine",
  cow: "Bovine",
  sheep: "Ovine",
};

const FEEDBACK: { reason: AIFeedbackReason; label: string }[] = [
  { reason: "no_animal", label: "There's no animal in the photo" },
  { reason: "wrong_animal", label: "It's a different animal" },
  { reason: "wrong_score", label: "The score looks wrong" },
];

// "G-11" -> "G-11, Islamabad" using the organization's city when the area has none.
const placeName = (item: CaseDetail) =>
  item.area.includes(",") || !item.organization?.city ? item.area : `${item.area}, ${item.organization.city}`;

// "waiting 2h" / "answered after 14h": how long the case went without a response.
function formatHours(hours: number) {
  if (hours < 1) return "under 1h";
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)} days`;
}

const responseLabel = (ai: CaseDetail["ai"]) =>
  ai.answered
    ? `Response Time (answered after ${formatHours(ai.hours_unanswered)})`
    : `Response Time (waiting ${formatHours(ai.hours_unanswered)})`;

const percent = (value: number | null | undefined) => Math.round((value ?? 0) * 100);
const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

function Gauge({ score }: { score: number }) {
  const tier = TIERS.find((item) => score >= item.min) ?? TIERS[2];
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: score / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, score]);

  return (
    <View style={styles.gauge} accessible accessibilityLabel={`${score} percent, ${tier.label}`}>
      <Svg width={RING} height={RING} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={RADIUS} stroke="#E8F3F0" strokeWidth={16} fill="none" />
        <AnimatedCircle
          cx={100}
          cy={100}
          r={RADIUS}
          stroke={tier.ring}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] })}
          transform="rotate(-90 100 100)"
        />
      </Svg>
      <View style={styles.gaugeCenter}>
        <Text style={styles.score}>{score}%</Text>
        <View style={styles.tierRow}>
          <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
          <Text
            style={[styles.tierText, styles.tierFit, { color: tier.color }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {tier.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

// The photo cropped to the detector's box, like the design's detection thumbnail.
function DetectionThumb({ uri, box }: { uri: string; box: CaseDetail["ai"]["box"] }) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const SIZE = 80;

  let frame = { width: SIZE, height: SIZE, left: 0, top: 0 };
  if (natural && box) {
    const [x0, y0, x1, y1] = box;
    const boxSide = Math.max((x1 - x0) * natural.width, (y1 - y0) * natural.height) * 1.15;
    // Zoom to the box but never so little that the photo stops filling the square.
    const scale = Math.max(SIZE / boxSide, SIZE / natural.width, SIZE / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    const centerX = ((x0 + x1) / 2) * width;
    const centerY = ((y0 + y1) / 2) * height;
    frame = {
      width,
      height,
      left: Math.min(0, Math.max(SIZE - width, SIZE / 2 - centerX)),
      top: Math.min(0, Math.max(SIZE - height, SIZE / 2 - centerY)),
    };
  }

  return (
    <View style={styles.thumb}>
      <Image
        source={{ uri }}
        style={natural && box ? { position: "absolute", ...frame } : StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={(event) => setNatural({ width: event.source.width, height: event.source.height })}
      />
      <View style={styles.thumbBracket} pointerEvents="none" />
      <Text style={styles.thumbTag}>AI</Text>
    </View>
  );
}

function FactorRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.factor}>
      <View style={styles.factorTop}>
        <Text style={styles.factorLabel}>{label}</Text>
        <Text style={styles.factorValue}>{value}%</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function ConfidenceScreen() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AIFeedbackReason | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await getCase(caseId);
      setItem(detail);
      setFeedback(detail.ai.my_feedback);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this case.");
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/cases/${caseId}` as Href));

  const explain = () =>
    Alert.alert(
      "How this score works",
      "50% comes from the animal detector checking the photos, 30% from the severity the reporter chose, and 20% from how many people reported the same animal. More reports and photos make it stronger.\n\nIf no organization responds, the score starts falling 6 hours after the latest report, down to half after 3 days. A new report restarts that clock, and it stops once an organization accepts the case.\n\nThe score helps rescuers see which reports to check first. It never rejects a report, and it doesn't judge the animal's condition.",
    );

  const send = async (reason: AIFeedbackReason) => {
    if (!item) return;
    setSending(true);
    try {
      await sendAIFeedback(item.id, reason);
      setFeedback(reason);
    } catch (err) {
      if (err instanceof SessionExpiredError) router.push("/auth-sheet");
      else Alert.alert("Couldn't send feedback", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const reportIncorrect = () => {
    if (!isSignedIn) {
      router.push("/auth-sheet");
      return;
    }
    Alert.alert("What's wrong with the detection?", "The rescue organization will see your answer.", [
      ...FEEDBACK.map((option) => ({ text: option.label, onPress: () => send(option.reason) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const ai = item?.ai;
  const score = item?.confidence_score;
  const severity = item ? SEVERITY[item.severity] ?? SEVERITY.medium : SEVERITY.medium;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to the case"
          onPress={back}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <MaterialIcons name="chevron-left" size={28} color="#334155" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Animal detection confidence
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Learn about the detection score"
          onPress={explain}
          style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}
        >
          <Feather name="info" size={19} color="#94A3B8" />
        </Pressable>
      </View>

      {!item || !ai ? (
        <View style={styles.centered}>
          {error ? <Text style={styles.empty}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {score != null ? (
              <Gauge score={score} />
            ) : (
              <View style={[styles.gauge, styles.unscored]}>
                <Text style={styles.score}>—</Text>
                <Text style={[styles.tierText, { color: "#94A3B8" }]}>Not scored yet</Text>
              </View>
            )}
            <Text style={styles.disclaimer}>
              {score != null
                ? "This score is an estimate based on the uploaded images, reported severity, related reports and how long the case has waited for a response. It does not determine the animal's condition."
                : "The photo hasn't been checked by the animal detector yet. Rescuers can still see and respond to this report."}
            </Text>
          </View>

          {ai.scored && (
            <View style={styles.card}>
              <View style={styles.detection}>
                {!!ai.image && <DetectionThumb uri={ai.image} box={ai.box} />}
                <View style={styles.detectionMeta}>
                  <View style={styles.detectionTop}>
                    <Text style={styles.detected} numberOfLines={1}>
                      {ai.animal ? `Detected: ${capitalize(ai.animal)}` : "No animal detected"}
                    </Text>
                    <Text style={styles.match}>{percent(ai.animal_confidence)}% Match</Text>
                  </View>
                  <View style={styles.severityRow}>
                    <Text style={styles.severityLabel}>Severity:</Text>
                    <View style={[styles.severityBadge, { backgroundColor: severity.background, borderColor: severity.border }]}>
                      <View style={[styles.severityDot, { backgroundColor: severity.color }]} />
                      <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.caseLine} numberOfLines={1}>
                    Case #{item.reference}
                    {item.area ? ` · ${placeName(item)}` : ""}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {ai.scored && (
            <View style={[styles.card, styles.breakdown]}>
              <View style={styles.breakdownTop}>
                <Text style={styles.breakdownTitle}>Analysis Breakdown</Text>
                <Text style={styles.model}>{ai.model}</Text>
              </View>
              <FactorRow
                label={`${ai.animal ? `Visual ${ANIMAL_WORD[ai.animal] ?? capitalize(ai.animal)} Identification` : "Animal Seen in Photo"}${
                  ai.photo_count > 1 ? ` (${ai.photo_count} photos)` : ""
                }`}
                value={percent(ai.photo_confidence)}
                color={colors.primary}
              />
              <FactorRow
                label={`Reported Severity (${capitalize(item.severity)})`}
                value={percent(ai.severity_weight)}
                color={colors.primary}
              />
              <FactorRow
                label={`Related Reports (${ai.report_count})`}
                value={percent(ai.report_weight)}
                color={colors.warning}
              />
              <FactorRow
                label={responseLabel(ai)}
                value={percent(ai.freshness)}
                color={ai.freshness >= 0.9 ? colors.primary : ai.freshness >= 0.7 ? colors.warning : colors.critical}
              />
            </View>
          )}

          {item.possibly_invalid && (
            <View style={styles.warning}>
              <MaterialIcons name="info-outline" size={16} color="#B7791F" />
              <Text style={styles.warningText}>
                The detector couldn&apos;t clearly see an animal, so rescuers are asked to double-check this report.
              </Text>
            </View>
          )}

          {ai.scored && (
            <View style={styles.feedbackRow}>
              {feedback ? (
                <View style={styles.feedbackDone} accessibilityLiveRegion="polite">
                  <MaterialIcons name="check-circle" size={16} color={colors.secondary} />
                  <Text style={styles.feedbackDoneText}>Thanks, the organization will review the detection.</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={reportIncorrect}
                  disabled={sending}
                  hitSlop={8}
                  style={({ pressed }) => [styles.feedback, pressed && styles.feedbackPressed]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#94A3B8" />
                  ) : (
                    <Feather name="flag" size={15} color="#94A3B8" />
                  )}
                  <Text style={styles.feedbackText}>Report incorrect AI detection</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={back}
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
        >
          <Text style={styles.backText}>Back to Case Details</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAF9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textAlign: "center" },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    zIndex: 1,
  },
  navButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  navPressed: { backgroundColor: "#F1F5F9" },
  title: { fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: -0.4, color: "#0F172A" },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },
  hero: {
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gauge: { width: RING, height: RING, marginVertical: 4, alignItems: "center", justifyContent: "center" },
  unscored: { borderRadius: RING / 2, borderWidth: 16, borderColor: "#E8F3F0", gap: 6 },
  gaugeCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  score: { fontFamily: fonts.displayExtraBold, fontSize: 48, lineHeight: 52, letterSpacing: -1.2, color: "#0F172A" },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  // Room inside the ring at the label's height; longer labels ("Medium confidence") shrink.
  tierFit: { maxWidth: 122 },
  // Manrope, as in the design: Inter is too wide to sit inside the ring.
  tierText: { fontFamily: fonts.displayBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" },
  disclaimer: {
    marginTop: 12,
    paddingHorizontal: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detection: { flexDirection: "row", alignItems: "center", gap: 16 },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(53,169,130,0.4)",
    backgroundColor: "#F1F5F9",
  },
  thumbBracket: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.secondary,
    opacity: 0.8,
  },
  thumbTag: {
    position: "absolute",
    right: 4,
    bottom: 4,
    overflow: "hidden",
    paddingHorizontal: 4,
    borderRadius: 4,
    backgroundColor: "rgba(30,107,86,0.9)",
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: -0.3,
    color: colors.onPrimary,
  },
  detectionMeta: { flex: 1, minWidth: 0, gap: 4 },
  detectionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  detected: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 20, color: "#0F172A" },
  match: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.primary,
  },
  severityRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2 },
  severityLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#64748B" },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 },
  caseLine: { paddingTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "#64748B" },
  breakdown: { gap: 14 },
  breakdownTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  breakdownTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#94A3B8",
  },
  model: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.primary, textAlign: "right" },
  factor: { gap: 6 },
  factorTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  factorLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#334155" },
  factorValue: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: "#0F172A" },
  bar: { height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "#F1F5F9" },
  barFill: { height: "100%", borderRadius: 4 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF7ED",
  },
  warningText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, color: "#8A5A12" },
  feedbackRow: { alignItems: "center", paddingTop: 4 },
  feedback: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 8 },
  feedbackPressed: { opacity: 0.7 },
  feedbackText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#64748B" },
  feedbackDone: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedbackDoneText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#1E8A66" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: colors.surface,
  },
  backButton: {
    height: 48,
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
  backPressed: { backgroundColor: "#175443", transform: [{ scale: 0.99 }] },
  backText: { fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 0.35, color: colors.onPrimary },
});
