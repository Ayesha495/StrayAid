import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../../theme/tokens";

// Shown on the report screen (Stitch 7) when the animal detector finds no animal in the
// photo. Reports need a real photo of the animal, to keep out false reports.

type Props = {
  visible: boolean;
  photoUri: string | null;
  onRetake: () => void;
  onChooseAnother: () => void;
  onClose: () => void;
  canUseCamera: boolean;
};

export default function NotAnimalModal({ visible, photoUri, onRetake, onChooseAnother, onClose, canUseCamera }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.photoWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]} />
            )}
            <View style={styles.badge}>
              <MaterialIcons name="hide-image" size={20} color={colors.onPrimary} />
            </View>
          </View>

          <Text style={styles.title} accessibilityRole="header">
            No animal found in this photo
          </Text>
          <Text style={styles.body}>
            Reports need a photo of the animal so rescuers know what to expect, and so false reports are kept out.
            Please retake a clear, close photo of the animal and try again.
          </Text>

          <View style={styles.actions}>
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
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={6} style={styles.close}>
              <Text style={styles.closeText}>Not now</Text>
            </Pressable>
          </View>
        </View>
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
    alignItems: "center",
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
    backgroundColor: colors.critical,
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
    marginBottom: 20,
  },
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
