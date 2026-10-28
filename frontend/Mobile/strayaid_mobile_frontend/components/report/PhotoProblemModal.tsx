import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../../theme/tokens";
import type { PhotoProblem } from "../../utils/photoProblems";

// Shown on the report screens (Stitch 7 and 8) when the photo can't be checked or the report
// can't be sent: says what actually went wrong (no animal in the photo, an unusable file, no
// connection, the checker still starting...) and what to do next.

type Props = {
  problem: PhotoProblem | null;
  photoUri: string | null;
  canUseCamera: boolean;
  onRetake: () => void;
  onChooseAnother: () => void;
  onRetry: () => void;
  onClose: () => void;
};

export default function PhotoProblemModal({
  problem,
  photoUri,
  canUseCamera,
  onRetake,
  onChooseAnother,
  onRetry,
  onClose,
}: Props) {
  const needsNewPhoto = problem?.fix === "photo";
  // Photo problems are the person's to fix (coral); the rest are connection or server trouble (blue).
  const tint = needsNewPhoto ? colors.critical : colors.info;

  return (
    <Modal visible={!!problem} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {problem && (
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.photoWrap}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]} />
                )}
                <View style={[styles.badge, { backgroundColor: tint }]}>
                  <MaterialIcons name={problem.icon} size={20} color={colors.onPrimary} />
                </View>
              </View>

              <Text style={styles.title} accessibilityRole="header">
                {problem.title}
              </Text>
              <Text style={styles.body}>{problem.message}</Text>

              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>What to do next</Text>
                {problem.steps.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.actions}>
              {needsNewPhoto ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={canUseCamera ? onRetake : onChooseAnother}
                    style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                  >
                    <MaterialIcons name={canUseCamera ? "photo-camera" : "photo-library"} size={18} color={colors.onPrimary} />
                    <Text style={styles.primaryText}>{canUseCamera ? "Retake photo" : "Choose another photo"}</Text>
                  </Pressable>
                  {canUseCamera && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onChooseAnother}
                      style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
                    >
                      <Text style={styles.secondaryText}>Choose from gallery</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetry}
                  style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
                >
                  <MaterialIcons name="refresh" size={18} color={colors.onPrimary} />
                  <Text style={styles.primaryText}>Try again</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={6} style={styles.close}>
                <Text style={styles.closeText}>Not now</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "90%",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  scroll: { alignItems: "center" },
  photoWrap: { marginBottom: 18 },
  photo: { width: 96, height: 96, borderRadius: 20, backgroundColor: "#F3F4F6", opacity: 0.85 },
  photoEmpty: { borderWidth: 1, borderColor: "#E5E7EB" },
  badge: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  steps: {
    alignSelf: "stretch",
    gap: 8,
    padding: 14,
    marginBottom: 18,
    borderRadius: 16,
    backgroundColor: colors.canvas,
  },
  stepsTitle: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: colors.ink, marginBottom: 2 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.primary },
  stepText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: "#334155" },
  actions: { alignSelf: "stretch", gap: 10 },
  primary: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryPressed: { backgroundColor: "#165343" },
  primaryText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
  secondary: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: { backgroundColor: "#F9FAFB" },
  secondaryText: { fontFamily: fonts.displayBold, fontSize: 14, color: "#1F2937" },
  close: { alignItems: "center", paddingVertical: 8 },
  closeText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: "#64748B" },
});
