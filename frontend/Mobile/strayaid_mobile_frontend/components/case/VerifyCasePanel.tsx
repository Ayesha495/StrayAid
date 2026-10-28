import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { SessionExpiredError } from "../../services/apiClient";
import {
  CaseVerification,
  removeVerification,
  verifyCase,
  VerificationResponse,
  VerifyResult,
} from "../../services/caseService";
import { getCurrentLocation, hasLocationPermission } from "../../services/locationService";
import { isNetworkError } from "../../services/offlineQueue";
import type { LatLng } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";
import { timeAgo } from "../../utils/format";

// "Is this animal still there?" Community verification of a rescue case, like confirming
// a reported road blockage on a map. Anyone signed in (except the case's reporters) answers
// Yes or No; a Yes can add "needs urgent help". Answers raise or lower the case's
// confidence score, and nearby answers count more, so the phone's location is sent if the
// person allows it. `compact` is the one-row version on the Explore map card.

type Props = {
  caseId: number;
  verification: CaseVerification;
  onVerified: (result: VerifyResult) => void;
  compact?: boolean;
};

const STATUS_TEXT: Record<CaseVerification["status"], { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  unverified: { label: "Not verified yet", color: "#64748B", icon: "help-outline" },
  verified: { label: "Verified by the community", color: colors.primary, icon: "verified" },
  mixed: { label: "Mixed answers", color: "#8A5A12", icon: "compare-arrows" },
  disputed: { label: "Mostly not found", color: colors.criticalInk, icon: "report-gmailerrorred" },
};

// Location is a bonus (nearby answers count more), so never wait long for it.
async function locationIfQuick(): Promise<LatLng | null> {
  try {
    if (!(await hasLocationPermission())) return null;
    return await Promise.race([
      getCurrentLocation(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
  } catch {
    return null;
  }
}

function tap() {
  Haptics.selectionAsync().catch(() => null);
}

export default function VerifyCasePanel({ caseId, verification, onVerified, compact = false }: Props) {
  const [busy, setBusy] = useState<VerificationResponse | "urgent" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After a fresh "Yes", ask the quick follow-up.
  const [askUrgent, setAskUrgent] = useState(false);
  const [editing, setEditing] = useState(false);

  const answered = verification.my_response;
  const total = verification.confirmations + verification.disputes;
  const status = STATUS_TEXT[verification.status];

  const send = async (response: VerificationResponse, urgent = false) => {
    if (busy) return;
    tap();
    setBusy(urgent ? "urgent" : response);
    setError(null);
    try {
      const location = await locationIfQuick();
      const result = await verifyCase(caseId, response, { urgent, location });
      onVerified(result);
      setEditing(false);
      setAskUrgent(response === "confirmed" && !urgent);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (busy) return;
    setBusy("undo");
    setError(null);
    try {
      onVerified(await removeVerification(caseId));
      setAskUrgent(false);
      setEditing(false);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const handleError = (err: unknown) => {
    if (err instanceof SessionExpiredError) {
      router.push("/auth-sheet");
      return;
    }
    setError(
      isNetworkError(err)
        ? "Your answer wasn't sent. Check your connection and try again."
        : err instanceof Error
          ? err.message
          : "Your answer wasn't sent. Please try again."
    );
  };

  // Nothing to ask on closed cases.
  if (verification.blocked === "closed") return null;

  const tally = total > 0 && (
    <View style={styles.tally} accessible accessibilityLabel={`${verification.confirmations} confirmed, ${verification.disputes} could not find it`}>
      <View style={styles.tallyBar}>
        <View style={[styles.tallyYes, { flex: verification.confirmations }]} />
        <View style={[styles.tallyNo, { flex: verification.disputes }]} />
      </View>
      <Text style={styles.tallyText}>
        <Text style={styles.tallyYesText}>{verification.confirmations} confirmed</Text>
        {"  ·  "}
        <Text style={styles.tallyNoText}>{verification.disputes} couldn&apos;t find it</Text>
        {verification.urgent > 0 ? `  ·  ${verification.urgent} said urgent` : ""}
      </Text>
    </View>
  );

  const question = (
    <View style={[styles.answers, compact && styles.answersCompact]}>
      <AnswerButton
        label={compact ? "Yes" : "Yes, it's there"}
        icon="check"
        tone="yes"
        selected={answered === "confirmed"}
        busy={busy === "confirmed"}
        onPress={() => send("confirmed")}
        compact={compact}
      />
      <AnswerButton
        label={compact ? "No" : "No, not there"}
        icon="close"
        tone="no"
        selected={answered === "not_found"}
        busy={busy === "not_found"}
        onPress={() => send("not_found")}
        compact={compact}
      />
    </View>
  );

  const followUp = askUrgent && answered === "confirmed" && !verification.my_urgent && (
    <View style={styles.followUp}>
      <Text style={styles.followUpText}>Does it need urgent help? (injured, in traffic, trapped)</Text>
      <View style={styles.followUpRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => send("confirmed", true)}
          style={({ pressed }) => [styles.urgentButton, pressed && styles.pressed]}
        >
          {busy === "urgent" ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.urgentText}>Yes, urgent</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAskUrgent(false)}
          style={({ pressed }) => [styles.notUrgentButton, pressed && styles.pressed]}
        >
          <Text style={styles.notUrgentText}>No</Text>
        </Pressable>
      </View>
    </View>
  );

  const thanks = answered && !editing && (
    <View style={styles.thanks}>
      <MaterialIcons
        name={answered === "confirmed" ? "check-circle" : "cancel"}
        size={18}
        color={answered === "confirmed" ? colors.primary : colors.criticalInk}
      />
      <Text style={styles.thanksText} numberOfLines={2}>
        {answered === "confirmed"
          ? verification.my_urgent
            ? "You confirmed it's there and needs urgent help"
            : "You confirmed it's there"
          : "You said you couldn't find it"}
        {verification.my_updated_at ? ` · ${timeAgo(verification.my_updated_at)}` : ""}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8}>
        <Text style={styles.link}>Change</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={undo} hitSlop={8} disabled={!!busy}>
        {busy === "undo" ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.link}>Undo</Text>}
      </Pressable>
    </View>
  );

  const body =
    verification.blocked === "sign_in" ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/auth-sheet")}
        style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
      >
        <MaterialIcons name="login" size={16} color={colors.primary} />
        <Text style={styles.signInText}>Sign in to verify this report</Text>
      </Pressable>
    ) : verification.blocked === "reporter" ? (
      <Text style={styles.note}>You reported this case. People nearby will confirm it, which raises its confidence.</Text>
    ) : (
      <>
        {thanks || question}
        {followUp}
      </>
    );

  if (compact) {
    return (
      <View style={styles.compact}>
        <View style={styles.compactHead}>
          <MaterialIcons name="groups" size={16} color={colors.info} />
          <Text style={styles.compactTitle}>Is this animal still there?</Text>
          {total > 0 && (
            <Text style={[styles.compactCount, { color: status.color }]}>
              {verification.confirmations}✓ {verification.disputes}✗
            </Text>
          )}
        </View>
        {body}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <MaterialIcons name="groups" size={18} color={colors.info} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title} accessibilityRole="header">
            Is this animal still there?
          </Text>
          <Text style={styles.subtitle}>
            If you&apos;re nearby, your answer helps rescuers trust this report. Answers from within 1 km count most.
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <MaterialIcons name={status.icon} size={15} color={status.color} />
        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
      </View>
      {tally}
      {body}
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

function AnswerButton({
  label,
  icon,
  tone,
  selected,
  busy,
  onPress,
  compact,
}: {
  label: string;
  icon: "check" | "close";
  tone: "yes" | "no";
  selected: boolean;
  busy: boolean;
  onPress: () => void;
  compact: boolean;
}) {
  const color = tone === "yes" ? colors.primary : colors.criticalInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, busy }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.answer,
        compact && styles.answerCompact,
        { borderColor: selected ? color : colors.border },
        selected && { backgroundColor: tone === "yes" ? colors.mint : colors.criticalSoft },
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          <MaterialIcons name={icon} size={compact ? 16 : 18} color={color} />
          <Text style={[styles.answerText, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#F8FBFF",
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(74,144,226,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1 },
  title: { fontFamily: fonts.displayBold, fontSize: 15, lineHeight: 21, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: "#64748B", marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5 },
  tally: { gap: 6 },
  tallyBar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "#E2E8F0" },
  tallyYes: { backgroundColor: colors.secondary },
  tallyNo: { backgroundColor: colors.critical },
  tallyText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#64748B" },
  tallyYesText: { color: colors.primary, fontFamily: fonts.bodySemiBold },
  tallyNoText: { color: colors.criticalInk, fontFamily: fonts.bodySemiBold },
  answers: { flexDirection: "row", gap: 10 },
  answersCompact: { gap: 8 },
  answer: {
    flex: 1,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  answerCompact: { height: 38, borderRadius: 12 },
  answerText: { fontFamily: fonts.displayBold, fontSize: 14 },
  followUp: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.warningSoft },
  followUpText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 17, color: "#5C3D0A" },
  followUpRow: { flexDirection: "row", gap: 8 },
  urgentButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.criticalInk,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentText: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.onPrimary },
  notUrgentButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notUrgentText: { fontFamily: fonts.displayBold, fontSize: 13, color: colors.ink },
  thanks: { flexDirection: "row", alignItems: "center", gap: 8 },
  thanksText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 17, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.primary },
  signIn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  signInText: { fontFamily: fonts.displayBold, fontSize: 13.5, color: colors.primary },
  note: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 18, color: "#64748B" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 17, color: colors.criticalInk },
  pressed: { opacity: 0.8 },
  compact: { gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  compactHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  compactTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 13, color: colors.ink },
  compactCount: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
