import { AntDesign, Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandBadge } from "../components/brand/BrandHeader";
import { SessionExpiredError } from "../services/apiClient";
import {
  clearReadNotifications,
  getNotifications,
  InboxNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTarget,
  NotificationKind,
} from "../services/inboxService";
import { colors, fonts } from "../theme/tokens";
import { shortTime } from "../utils/format";

// Stitch screen 20: Notifications.

const KIND_STYLE: Record<NotificationKind, { bg: string; fg: string; icon: (color: string) => ReactNode }> = {
  rescue: { bg: "#EAF4F1", fg: colors.primary, icon: (color) => <Feather name="alert-triangle" size={20} color={color} /> },
  chat: { bg: "#EFF6FF", fg: "#4A90E2", icon: (color) => <MaterialCommunityIcons name="chat-processing-outline" size={22} color={color} /> },
  adoption: { bg: "#ECFDF5", fg: "#059669", icon: (color) => <Feather name="heart" size={20} color={color} /> },
  sponsorship: {
    bg: "#FFFBEB",
    fg: "#E28543",
    icon: (color) => <AntDesign name="dollar" size={20} color={color} />,
  },
  community: { bg: "#F1F5F9", fg: "#475569", icon: (color) => <MaterialCommunityIcons name="account-group-outline" size={22} color={color} /> },
  alert: { bg: "#FFF1F2", fg: "#F43F5E", icon: (color) => <Feather name="map-pin" size={20} color={color} /> },
};

// "New post from **Hope Animal Shelter**." -> regular and bold pieces.
function RichBody({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <Text style={styles.body} numberOfLines={2}>
      {parts.map((part, index) =>
        index % 2 ? (
          <Text key={index} style={styles.bodyBold}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InboxNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getNotifications());
      setError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.replace("/auth-sheet");
        return;
      }
      setError(err instanceof Error ? err.message : "We couldn't load your notifications.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));
  const unreadCount = items?.filter((item) => item.unread).length ?? 0;
  const visible = (items ?? []).filter((item) => !unreadOnly || item.unread);

  const markAll = async () => {
    if (!unreadCount) return;
    setItems((current) => current?.map((item) => ({ ...item, unread: false })) ?? null);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const clearRead = async () => {
    try {
      await clearReadNotifications();
      setItems((current) => current?.filter((item) => item.unread) ?? null);
    } catch (err) {
      Alert.alert("Couldn't clear notifications", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const showOptions = () =>
    Alert.alert("Notifications", undefined, [
      { text: "Mark all read", onPress: markAll },
      { text: "Clear read notifications", style: "destructive", onPress: clearRead },
      { text: "Cancel", style: "cancel" },
    ]);

  const open = (item: InboxNotification) => {
    if (item.unread) {
      setItems((current) => current?.map((row) => (row.id === item.id ? { ...row, unread: false } : row)) ?? null);
      markNotificationRead(item.id);
    }
    const target = notificationTarget(item.data);
    if (target) router.push(target);
  };

  const empty = !items ? (
    <View style={styles.state}>
      {error ? (
        <>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  ) : (
    <View style={styles.state}>
      {unreadOnly ? (
        <View style={styles.emptyIcon}>
          <Feather name="bell" size={24} color={colors.primary} />
        </View>
      ) : (
        <BrandBadge size={56} />
      )}
      <Text style={styles.emptyTitle}>{unreadOnly ? "No unread notifications" : "You're all caught up"}</Text>
      <Text style={styles.stateText}>
        Rescue updates, messages, adoption and sponsorship news will appear here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.navButton, styles.navLeft, pressed && styles.navPressed]}>
          <Feather name="chevron-left" size={26} color="#1E293B" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Notifications
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Notification options" onPress={showOptions} style={({ pressed }) => [styles.navButton, styles.navRight, pressed && styles.navPressed]}>
          <MaterialIcons name="more-horiz" size={24} color="#475569" />
        </Pressable>
      </View>

      <View style={styles.filters}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !unreadOnly }}
          onPress={() => setUnreadOnly(false)}
          style={[styles.filter, styles.filterAll, !unreadOnly ? styles.filterOn : styles.filterOff]}
        >
          <Text style={[styles.filterText, !unreadOnly ? styles.filterTextOn : styles.filterTextOff]}>All</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: unreadOnly }}
          accessibilityLabel={`Unread, ${unreadCount}`}
          onPress={() => setUnreadOnly(true)}
          style={[styles.filter, unreadOnly ? styles.filterOn : styles.filterOff]}
        >
          <Text style={[styles.filterText, unreadOnly ? styles.filterTextOn : styles.filterTextOff]}>Unread</Text>
          {unreadCount > 0 && <View style={[styles.filterDot, unreadOnly && styles.filterDotOn]} />}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!unreadCount} onPress={markAll} hitSlop={8} style={styles.markAll}>
          <Text style={[styles.markAllText, !unreadCount && styles.markAllDone]}>Mark all read</Text>
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const kind = KIND_STYLE[item.kind] ?? KIND_STYLE.community;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.unread ? "Unread. " : ""}${item.title}. ${item.body.replace(/\*\*/g, "")}`}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.card, item.unread && styles.cardUnread, pressed && styles.cardPressed]}
            >
              <View style={[styles.icon, { backgroundColor: kind.bg }]}>{kind.icon(kind.fg)}</View>
              <View style={styles.content}>
                <View style={styles.contentTop}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={[styles.time, item.unread && styles.timeUnread]}>{shortTime(item.created_at)}</Text>
                </View>
                <RichBody text={item.body} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={empty}
        style={styles.listArea}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: colors.surface,
  },
  navButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  navLeft: { marginLeft: -8 },
  navRight: { marginRight: -8 },
  navPressed: { backgroundColor: "#F8FAFC", transform: [{ scale: 0.95 }] },
  title: { fontFamily: fonts.displayExtraBold, fontSize: 19, lineHeight: 28, letterSpacing: -0.5, color: "#0F172A" },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    zIndex: 1,
  },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterAll: { paddingHorizontal: 20 },
  filterOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterOff: { backgroundColor: "#F8FAFC", borderColor: "rgba(226,232,240,0.8)" },
  filterText: { fontSize: 12, lineHeight: 16 },
  filterTextOn: { fontFamily: fonts.bodyBold, color: colors.onPrimary },
  filterTextOff: { fontFamily: fonts.bodySemiBold, color: "#475569" },
  filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  filterDotOn: { backgroundColor: colors.onPrimary },
  markAll: { marginLeft: "auto" },
  markAllText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 16, color: "#94A3B8" },
  markAllDone: { opacity: 0.6 },
  listArea: { flex: 1, backgroundColor: "#F8F9FB" },
  list: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(241,245,249,0.9)",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardUnread: { borderColor: "rgba(53,169,130,0.25)" },
  cardPressed: { transform: [{ scale: 0.99 }] },
  icon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minWidth: 0, paddingRight: 4 },
  contentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  cardTitle: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#0F172A" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, color: "#94A3B8" },
  timeUnread: { fontFamily: fonts.bodySemiBold, color: colors.primary },
  body: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 20.3, color: "#475569" },
  bodyBold: { fontFamily: fonts.bodySemiBold, color: "#1E293B" },
  state: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 32, gap: 10 },
  stateText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#64748B", textAlign: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: "#0F172A" },
  retry: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPrimary },
});
