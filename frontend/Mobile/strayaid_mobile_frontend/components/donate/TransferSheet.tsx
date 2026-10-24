import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../../theme/tokens";
import { pickPhoto, PickedPhoto } from "../../utils/pickPhoto";

// "Transfer, then attach the receipt" sheet. StrayAid has no payment gateway (free services
// only): people pay the organization by bank transfer and it confirms the receipt.

type Bank = { bank?: string; title?: string; number?: string };

type Props = {
  visible: boolean;
  title: string;
  body: string;
  bank: Bank;
  // What the success message says, e.g. "Paws & Care Rescue will check your receipt...".
  thanks: { title: string; body: string };
  onSend: (receipt: PickedPhoto) => Promise<void>;
  onClose: () => void;
};

export default function TransferSheet({ visible, title, body, bank, thanks, onSend, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [receipt, setReceipt] = useState<PickedPhoto | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    if (sending) return;
    setReceipt(null);
    setSent(false);
    onClose();
  };

  const attach = () =>
    Alert.alert("Attach your receipt", "A screenshot or photo of the bank transfer.", [
      { text: "Choose from gallery", onPress: async () => setReceipt((await pickPhoto("library", "attach the receipt")) ?? receipt) },
      { text: "Take a photo", onPress: async () => setReceipt((await pickPhoto("camera", "attach the receipt")) ?? receipt) },
      { text: "Cancel", style: "cancel" },
    ]);

  const send = async () => {
    if (!receipt) {
      attach();
      return;
    }
    setSending(true);
    try {
      await onSend(receipt);
      setSent(true);
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={close}>
        <Pressable accessible={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => null}>
          <View style={styles.handle} />
          {sent ? (
            <View style={styles.sent}>
              <View style={styles.sentIcon}>
                <MaterialIcons name="favorite" size={30} color={colors.primary} />
              </View>
              <Text style={styles.title}>{thanks.title}</Text>
              <Text style={styles.body}>{thanks.body}</Text>
              <Pressable accessibilityRole="button" onPress={close} style={styles.button}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
              <View style={styles.bank}>
                {!!bank.bank && <BankRow label="Bank" value={bank.bank} />}
                {!!bank.title && <BankRow label="Account title" value={bank.title} />}
                {!!bank.number && <BankRow label="Account number" value={bank.number} big />}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={receipt ? "Change the receipt" : "Attach the receipt"}
                onPress={attach}
                style={({ pressed }) => [styles.receipt, receipt && styles.receiptDone, pressed && styles.pressed]}
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
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, !receipt && styles.buttonSoft]}
              >
                {sending ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>{receipt ? "Send" : "Attach receipt to continue"}</Text>
                )}
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  sheet: { paddingHorizontal: 24, paddingTop: 12, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginBottom: 4 },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 20, lineHeight: 26, color: "#111827" },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: "#4B5563" },
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
  pressed: { backgroundColor: "#F1F5F4" },
  receiptIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  receiptThumb: { width: 44, height: 44, borderRadius: 12 },
  receiptTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: "#111827" },
  receiptSub: { fontFamily: fonts.body, fontSize: 12, color: "#64748B" },
  button: { height: 50, marginTop: 4, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonPressed: { backgroundColor: "#165242" },
  buttonSoft: { backgroundColor: "#4D8C7A" },
  buttonText: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.onPrimary },
  sent: { alignItems: "center", gap: 12, paddingTop: 8 },
  sentIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
