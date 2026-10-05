import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/auth/AuthButtons";
import VoiceInputButton from "../../components/VoiceInputButton";
import { submitReport } from "../../services/mobileContentService";
import { resetReportDraft, updateReportDraft, useReportDraft } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";
import { appendFile } from "../../utils/formFile";

// Report step 2. INTERIM: keeps reporting working end to end until Stitch screen 8
// (description, severity, keep me updated) replaces this screen.

export default function ReportDetailsScreen() {
  const draft = useReportDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    if (!draft.photo || !draft.location) {
      router.back();
      return;
    }
    if (!draft.description.trim()) {
      setError("Describe what happened so rescuers know what to expect.");
      return;
    }

    const form = new FormData();
    form.append("description", draft.description.trim());
    form.append("latitude", draft.location.latitude.toString());
    form.append("longitude", draft.location.longitude.toString());
    if (draft.address) form.append("area", draft.address);

    setError(null);
    setSubmitting(true);
    try {
      await appendFile(form, "image", draft.photo);
      await submitReport(form);
      resetReportDraft();
      router.dismissAll();
      router.replace("/(tabs)/home");
      Alert.alert("Report sent", "Thank you. Nearby rescue organizations can now see this animal.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={30} color="#1F2937" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Report an animal in need
        </Text>
        <View style={styles.navSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>What happened?</Text>
          <View style={styles.descriptionBox}>
            <TextInput
              style={styles.description}
              value={draft.description}
              onChangeText={(description) => {
                updateReportDraft({ description });
                if (error) setError(null);
              }}
              placeholder="Describe the animal's condition and what help it needs."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.voice}>
              <VoiceInputButton value={draft.description} onChangeText={(description) => updateReportDraft({ description })} />
            </View>
          </View>

          {error && (
            <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <MaterialIcons name="error-outline" size={16} color={colors.critical} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label="Submit Rescue Report" onPress={submit} loading={submitting} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: { width: 36, height: 36, marginLeft: -4, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F3F4F6" },
  title: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: -0.4, color: "#111827" },
  navSpacer: { width: 36, height: 36 },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  label: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.ink },
  descriptionBox: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 14,
  },
  description: { flex: 1, minHeight: 100, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  voice: { alignSelf: "flex-end" },
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
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
});
