import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, fonts, type } from "../../theme/tokens";
import LogoMark from "../brand/Logo";

// Stitch screen 2: app header, search and the "Report an Animal" call to action.

type HeaderProps = {
  onNotificationsPress: () => void;
  hasUnread: boolean;
  onMessagesPress: () => void;
  unreadMessages: number;
  onSearchPress: () => void;
  searching: boolean;
};

export function HomeHeader({ onNotificationsPress, hasUnread, onMessagesPress, unreadMessages, onSearchPress, searching }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.logoBadge}>
          <LogoMark size={22} color={colors.primary} />
        </View>
        <Text style={styles.wordmark}>StrayAid</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searching ? "Close search" : "Search the feed"}
          accessibilityState={{ expanded: searching }}
          onPress={onSearchPress}
          hitSlop={4}
          style={({ pressed }) => [styles.bell, searching && styles.searchOn, pressed && styles.pressed]}
        >
          <MaterialIcons name="search" size={23} color={searching ? colors.primary : colors.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}
          onPress={onMessagesPress}
          hitSlop={4}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <MaterialIcons name="chat-bubble-outline" size={21} color={colors.ink} />
          {unreadMessages > 0 && <View style={styles.unreadDot} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasUnread ? "Notifications, unread" : "Notifications"}
          onPress={onNotificationsPress}
          hitSlop={4}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <MaterialIcons name="notifications-none" size={24} color={colors.ink} />
          {hasUnread && <View style={styles.unreadDot} />}
        </Pressable>
      </View>
    </View>
  );
}

export function HomeSearchBar({
  value,
  onChangeText,
  onCancel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.searchRow}>
    <View style={styles.searchWrap}>
      <MaterialIcons name="search" size={18} color={colors.inkMuted} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search..."
        placeholderTextColor={colors.inkMuted}
        style={styles.searchInput}
        returnKeyType="search"
        accessibilityLabel="Search the feed"
        clearButtonMode="while-editing"
        autoFocus
      />
    </View>
      <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

export function ReportAnimalButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.reportButton, pressed && styles.reportPressed]}
    >
      <MaterialIcons name="add-circle" size={20} color={colors.onPrimary} />
      <Text style={styles.reportLabel}>Report an Animal</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.surface,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 2, marginRight: -8 },
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: "#F1F5F9" },
  unreadDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.critical,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  searchOn: { backgroundColor: colors.mint },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginTop: 4, marginBottom: 12 },
  cancel: { paddingVertical: 8 },
  cancelText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primary },
  searchWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAF9",
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: { marginLeft: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingRight: 16,
    ...type.bodyMd,
    lineHeight: undefined,
    color: colors.ink,
  },
  reportButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  reportPressed: { backgroundColor: "#165242", transform: [{ scale: 0.99 }] },
  reportLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.onPrimary },
});
