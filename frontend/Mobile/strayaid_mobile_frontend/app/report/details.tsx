import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Toggle from "../../components/ui/Toggle";
import VoiceInputButton from "../../components/VoiceInputButton";
import { SessionExpiredError } from "../../services/apiClient";
import { submitReport } from "../../services/mobileContentService";
import { registerForPushNotifications, sendPushTokenToBackend } from "../../services/notificationService";
import { resetReportDraft, Severity, updateReportDraft, useReportDraft } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";
import { appendFile } from "../../utils/formFile";

// Stitch screen 8: Report an animal, step 2 (what happened, severity, keep me updated).

const SEVERITIES: { value: Severity; label: string; color: string; text: string }[] = [
  { value: "low", label: "Low", color: colors.secondary, text: colors.onPrimary },
  { value: "medium", label: "Medium", color: colors.warning, text: "#4A3000" },
  { value: "high", label: "High", color: "#E5534B", text: colors.onPrimary },
  { value: "critical", label: "Critical", color: "#B42318", text: colors.onPrimary },
];

export default function ReportDetailsScreen() {
  const draft = useReportDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    // Step 1 was skipped somehow (e.g. the app reloaded): go back and add them.
    if (!draft.photo || !draft.location) {
      if (router.canGoBack()) router.back();
      else router.replace("/report");
      return;
    }
    if (!draft.description.trim()) {
      setError("Describe what happened so rescuers know what to expect.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("description", draft.description.trim());
      form.append("latitude", draft.location.latitude.toString());
      form.append("longitude", draft.location.longitude.toString());
      form.append("severity", draft.severity);
      form.append("keep_updated", draft.keepUpdated ? "true" : "false");
      if (draft.address) form.append("area", draft.address);
      await appendFile(form, "image", draft.photo);

      const result = await submitReport(form);
      // Updates arrive as push notifications, so this is the moment to ask for them.
      if (draft.keepUpdated) {
        registerForPushNotifications()
          .then((token) => (token ? sendPushTokenToBackend(token) : undefined))
          .catch(() => null);
      }
      resetReportDraft();
      // Leave the report form behind: back from the success screen goes to the tabs.
      router.dismissAll();
      router.push({
        pathname: "/report/success",
        params: {
          reportId: String(result.report_id),
          caseId: String(result.case.id),
          reference: result.case.reference,
          area: result.case.area || draft.address,
          severity: result.case.severity,
          confidence: result.case.confidence_score == null ? "" : String(result.case.confidence_score),
          keepUpdated: result.keep_updated ? "1" : "0",
        },
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        // The draft stays in memory, so after signing in they come back here and resend.
        setError("Your sign-in expired. Sign in again, then tap Submit. Your report is saved.");
        router.push("/auth-sheet");
      } else {
        setError(err instanceof Error ? err.message : "We couldn't send your report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          >
            <MaterialIcons name="chevron-left" size={30} color="#334155" />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Report an animal in need
          </Text>
        </View>
        <View style={styles.steps} accessible accessibilityLabel="Step 2 of 2">
          <View style={styles.stepDone} />
          <View style={styles.stepCurrent} />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>What happened?</Text>
              <Text style={styles.chip}>Detailed info helps</Text>
            </View>
            <View style={styles.descriptionWrap}>
              <TextInput
                style={[styles.description, !!error && styles.descriptionInvalid]}
                value={draft.description}
                onChangeText={(description) => {
                  updateReportDraft({ description });
                  if (error) setError(null);
                }}
                placeholder="Describe what you see, exact landmark, behavior..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                accessibilityLabel="What happened?"
              />
              <View style={styles.voice}>
                <VoiceInputButton
                  variant="pill"
                  value={draft.description}
                  onChangeText={(description) => updateReportDraft({ description })}
                />
              </View>
            </View>
          </View>

          <View style={styles.severitySection}>
            <View>
              <Text style={styles.label}>Severity</Text>
              <Text style={styles.hint}>Assists our AI triage and closest rescue priority</Text>
            </View>
            <View style={styles.severityRow} accessibilityRole="radiogroup">
              {SEVERITIES.map((option) => {
                const selected = draft.severity === option.value;
                return (
                  <View
                    key={option.value}
                    style={[styles.severityRing, selected && { borderColor: option.color }]}
                  >
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => updateReportDraft({ severity: option.value })}
                      style={[
                        styles.severity,
                        selected && [styles.severitySelected, { backgroundColor: option.color, shadowColor: option.color }],
                      ]}
                    >
                      <Text
                        style={[styles.severityText, selected && [styles.severityTextSelected, { color: option.text }]]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.updates}>
            <View style={styles.updatesText}>
              <Text style={styles.label}>Keep me updated</Text>
              <Text style={styles.hint}>Get updates about this rescue</Text>
            </View>
            <Toggle
              label="Keep me updated"
              value={draft.keepUpdated}
              onChange={(keepUpdated) => updateReportDraft({ keepUpdated })}
            />
          </View>

          <View style={styles.note}>
            <View style={styles.noteIcon}>
              <MaterialIcons name="shield" size={14} color={colors.primary} />
            </View>
            <Text style={styles.noteText}>
              A volunteer or vet shelter nearby will be notified once reported. Stay safe and avoid moving severely
              injured animals.
            </Text>
          </View>

          {error && (
            <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, submitting && styles.submitBusy]}
          >
            <Text style={styles.submitText}>{submitting ? "Sending report…" : "Submit Rescue Report"}</Text>
            {!submitting && <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />}
          </Pressable>
          <Text style={styles.footerNote}>Your report will be reviewed by a rescue organization.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F1F5F9" },
  title: { fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: -0.4, color: "#0F172A" },
  steps: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepDone: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CBD5E1" },
  stepCurrent: { width: 16, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  content: { paddingHorizontal: 20, paddingVertical: 16, gap: 20 },
  section: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: fonts.displayBold, fontSize: 14, lineHeight: 20, color: "#0F172A" },
  chip: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#F0F9F6",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },
  description: {
    height: 140,
    padding: 14,
    paddingBottom: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "rgba(248,250,252,0.8)",
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    lineHeight: 22,
    color: "#334155",
  },
  descriptionInvalid: { borderColor: colors.critical },
  // Matches the reference: the Voice pill sits 5px above the box's bottom edge.
  descriptionWrap: { paddingBottom: 5 },
  voice: { position: "absolute", right: 10, bottom: 10 },
  severitySection: { gap: 10 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "#64748B", marginTop: 2 },
  severityRow: { flexDirection: "row", gap: 8 },
  // Holds the 2px ring (with a 1px white gap) around the selected option.
  severityRing: { flex: 1, padding: 1, borderRadius: 15, borderWidth: 2, borderColor: "transparent", margin: -3 },
  severity: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  severitySelected: {
    borderWidth: 0,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  severityText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#334155" },
  severityTextSelected: { fontFamily: fonts.bodyBold, letterSpacing: -0.2 },
  updates: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "rgba(248,250,252,0.7)",
  },
  updatesText: { flex: 1, paddingRight: 8 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(209,250,229,0.8)",
    backgroundColor: "rgba(236,253,245,0.6)",
  },
  noteIcon: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    backgroundColor: "rgba(30,107,86,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 11.5, lineHeight: 18.7, color: "#475569" },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.criticalSoft,
  },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: "#B4483A" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: colors.surface,
  },
  submit: {
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  submitPressed: { backgroundColor: "#175645" },
  submitBusy: { opacity: 0.8 },
  submitText: { fontFamily: fonts.displayBold, fontSize: 14, color: colors.onPrimary },
  footerNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.2,
    color: "#94A3B8",
    textAlign: "center",
  },
});
