import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionExpiredError, authFetch } from "../../services/apiClient";
import {
  ChatFilter,
  ChatOrganization,
  Conversation,
  getInbox,
  getOrganizationsToMessage,
  Inbox,
  startConversation,
} from "../../services/chatService";
import { getCurrentUser } from "../../services/mobileContentService";
import { colors, fonts } from "../../theme/tokens";
import { shortTime } from "../../utils/format";

// Stitch screen 18: Messages inbox.

const FILTERS: { key: ChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shelters", label: "Shelters" },
  { key: "rescues", label: "Active Rescues" },
  { key: "adoptions", label: "Adoptions" },
];
// Avatar tints, as in the design, picked per conversation so each keeps its colour.
const AVATAR_TINTS = [
  { bg: "#E7F4EE", border: "rgba(30,107,86,0.2)", fg: colors.primary, icon: "paw" },
  { bg: "#ECFDF5", border: "rgba(167,243,208,0.8)", fg: "#35A182", icon: "emoticon-happy-outline" },
  { bg: "#FFFBEB", border: "#FDE68A", fg: "#F49B60", icon: "card-account-details-outline" },
  { bg: "#EFF6FF", border: "rgba(191,219,254,0.8)", fg: "#4A90E2", icon: "plus" },
] as const;
const POLL_MS = 10000;

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isOrganization, setIsOrganization] = useState(false);
  const [picker, setPicker] = useState<ChatOrganization[] | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const latest = useRef({ filter, query });
  latest.current = { filter, query };

  const load = useCallback(async () => {
    const { filter: chosen, query: text } = latest.current;
    try {
      const data = await getInbox(chosen, text);
      // Ignore answers for a filter or search that has since changed.
      if (latest.current.filter === chosen && latest.current.query === text) {
        setInbox(data);
        setError(null);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.replace("/auth-sheet");
        return;
      }
      setError(err instanceof Error ? err.message : "We couldn't load your messages.");
    }
  }, []);

  // New messages arrive while the inbox is open.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  useEffect(() => {
    const timer = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filter, query, load]);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setIsOrganization(user.role === "organization"))
      .catch(() => null);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));

  const markAllRead = async () => {
    const unread = inbox?.results.filter((row) => row.unread_count > 0) ?? [];
    await Promise.all(unread.map((row) => authFetch(`/api/chat/conversations/${row.id}/read/`, { method: "POST" }).catch(() => null)));
    load();
  };

  const showOptions = () =>
    Alert.alert("Messages", undefined, [
      { text: "Mark all as read", onPress: markAllRead },
      { text: "Notifications", onPress: () => router.push("/notifications" as Href) },
      { text: "Cancel", style: "cancel" },
    ]);

  const openPicker = async () => {
    setPicker([]);
    try {
      setPicker(await getOrganizationsToMessage());
    } catch (err) {
      setPicker(null);
      Alert.alert("Couldn't load organizations", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const startWith = async (organization: ChatOrganization) => {
    setOpening(organization.id);
    try {
      const conversation = await startConversation({ organizationId: organization.id });
      setPicker(null);
      router.push(`/messages/${conversation.id}` as Href);
    } catch (err) {
      Alert.alert("Couldn't start the chat", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setOpening(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}>
          <Feather name="chevron-left" size={24} color="#334155" />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Messages
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Options" onPress={showOptions} style={({ pressed }) => [styles.navButton, pressed && styles.navPressed]}>
          <Feather name="more-vertical" size={20} color="#475569" />
        </Pressable>
      </View>
      <View style={styles.search}>
        <Feather name="search" size={15} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages or shelters..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search messages or shelters"
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.key)}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
              {active && item.key === "all" && !!inbox?.total && (
                <View style={styles.filterCount}>
                  <Text style={styles.filterCountText}>{inbox.total}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const empty = !inbox ? (
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
      <View style={styles.emptyIcon}>
        <Feather name="message-circle" size={24} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{query || filter !== "all" ? "No chats found" : "No messages yet"}</Text>
      <Text style={styles.stateText}>
        {query || filter !== "all"
          ? "Try another search or filter."
          : isOrganization
          ? "When people message your organization, their chats appear here."
          : "Message a rescue organization about a case, an animal or anything else."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      {header}
      <FlatList
        data={inbox?.results ?? []}
        keyExtractor={(row) => String(row.id)}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={empty}
        ListFooterComponent={
          inbox?.response_minutes ? (
            <View style={styles.helpline}>
              <View style={styles.helplineIcon}>
                <Feather name="info" size={18} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.helplineTitle}>Rescue teams on chat</Text>
                <Text style={styles.helplineText}>
                  Shelters respond in avg. {inbox.response_minutes} {inbox.response_minutes === 1 ? "minute" : "minutes"} for critical
                  cases.
                </Text>
              </View>
            </View>
          ) : null
        }
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {!isOrganization && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New message"
          onPress={openPicker}
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && styles.navPressed]}
        >
          <Feather name="plus" size={24} color={colors.onPrimary} />
        </Pressable>
      )}

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable accessible={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => null}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>New message</Text>
            <Text style={styles.sheetSub}>Choose a rescue organization to message.</Text>
            {picker && picker.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={styles.sheetLoading} />
            ) : (
              <ScrollView style={styles.sheetList}>
                {picker?.map((organization) => (
                  <Pressable
                    key={organization.id}
                    accessibilityRole="button"
                    onPress={() => startWith(organization)}
                    style={({ pressed }) => [styles.orgRow, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.avatar, styles.orgAvatar]}>
                      {organization.image ? (
                        <Image source={{ uri: organization.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <MaterialCommunityIcons name="paw" size={20} color={colors.primary} />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.titleRow}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {organization.name}
                        </Text>
                        {organization.verified && <MaterialIcons name="verified" size={14} color={colors.primary} />}
                      </View>
                      {!!organization.city && <Text style={styles.preview}>{organization.city}</Text>}
                    </View>
                    {opening === organization.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Feather name="chevron-right" size={18} color="#CBD5E1" />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const unread = conversation.unread_count > 0;
  const tint = AVATAR_TINTS[conversation.id % AVATAR_TINTS.length];
  const last = conversation.last_message;
  const preview = last ? (last.body || (last.has_image ? "📷 Photo" : "")) : "No messages yet";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${conversation.title}${unread ? `, ${conversation.unread_count} unread` : ""}. ${preview}`}
      onPress={() => router.push(`/messages/${conversation.id}` as Href)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.avatarWrap}>
        {conversation.is_organization ? (
          <View
            style={[
              styles.avatar,
              { backgroundColor: tint.bg, borderColor: tint.border },
              unread && styles.avatarRing,
            ]}
          >
            {conversation.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name={tint.icon} size={22} color={tint.fg} />
            )}
          </View>
        ) : (
          <View style={[styles.avatar, styles.personAvatar]}>
            {conversation.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.initials}>{conversation.initials}</Text>
            )}
          </View>
        )}
        {conversation.active && <View style={styles.online} />}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.titleRow}>
            <Text style={[styles.rowTitle, !unread && styles.rowTitleRead]} numberOfLines={1}>
              {conversation.title}
            </Text>
            {conversation.verified && <MaterialIcons name="verified" size={15} color={colors.primary} />}
          </View>
          <Text style={[styles.time, unread && styles.timeUnread]}>{shortTime(conversation.last_message_at)}</Text>
        </View>
        {conversation.tag && (
          <View style={[styles.tag, TAG_STYLES[conversation.tag.tone].box]}>
            {conversation.tag.tone === "amber" && <View style={styles.tagDot} />}
            <Text style={[styles.tagText, TAG_STYLES[conversation.tag.tone].text]} numberOfLines={1}>
              {conversation.tag.label}
            </Text>
          </View>
        )}
        <View style={[styles.previewRow, !conversation.tag && styles.previewGap]}>
          {last?.from_me && <Feather name="check" size={13} color={colors.primary} style={styles.sentTick} />}
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {last?.from_me ? `You: ${preview}` : preview}
          </Text>
          {unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conversation.unread_count > 9 ? "9+" : conversation.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const TAG_STYLES = {
  amber: StyleSheet.create({
    box: { backgroundColor: "#FFFBEB", borderColor: "rgba(253,230,138,0.6)" },
    text: { color: "#B45309" },
  }),
  green: StyleSheet.create({
    box: { backgroundColor: "#ECFDF5", borderColor: "rgba(167,243,208,0.6)" },
    text: { color: "#047857" },
  }),
  grey: StyleSheet.create({
    box: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
    text: { color: "#64748B" },
  }),
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: colors.surface,
  },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 8 },
  navButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  navPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 28, letterSpacing: -0.45, color: "#0F172A" },
  search: {
    marginTop: 8,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.7)",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: { marginLeft: 14, marginRight: 8 },
  searchInput: { flex: 1, height: "100%", paddingRight: 12, fontFamily: fonts.body, fontSize: 12, color: "#1E293B" },
  filters: { gap: 8, marginTop: 12, paddingBottom: 2 },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  filterActive: {
    paddingHorizontal: 14,
    backgroundColor: colors.primary,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: "#475569" },
  filterTextActive: { fontFamily: fonts.bodySemiBold, color: colors.onPrimary },
  filterCount: { paddingHorizontal: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)" },
  filterCountText: { fontFamily: fonts.bodySemiBold, fontSize: 10, lineHeight: 14, color: colors.onPrimary },
  list: { flex: 1, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: "rgba(241,245,249,0.8)" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14 },
  rowPressed: { backgroundColor: "#F8FAFC" },
  avatarWrap: { marginRight: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: { borderWidth: 2 },
  personAvatar: { backgroundColor: "#E2E8F0", borderColor: "#CBD5E1" },
  orgAvatar: { backgroundColor: colors.mint, borderColor: "rgba(30,107,86,0.2)" },
  initials: { fontFamily: fonts.displayBold, fontSize: 14, color: "#475569" },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: "#35A182",
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  rowTitle: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 14, lineHeight: 20, color: "#0F172A" },
  rowTitleRead: { fontFamily: fonts.displaySemiBold },
  time: { fontFamily: fonts.displayMedium, fontSize: 11, lineHeight: 16, color: "#64748B" },
  timeUnread: { fontFamily: fonts.displaySemiBold, color: colors.primary },
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4, backgroundColor: "#F59E0B" },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14 },
  previewRow: { flexDirection: "row", alignItems: "center" },
  previewGap: { marginTop: 4 },
  sentTick: { marginRight: 4 },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "#64748B" },
  previewUnread: { fontFamily: fonts.bodySemiBold, color: "#1E293B", paddingRight: 8 },
  badge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, color: colors.onPrimary },
  helpline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mint,
    backgroundColor: "#F3FAF6",
  },
  helplineIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  helplineTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.ink },
  helplineText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: "#64748B" },
  state: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 32, gap: 10 },
  stateText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#64748B", textAlign: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: "#0F172A" },
  retry: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPrimary },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" },
  sheet: { paddingTop: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, maxHeight: "75%" },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginBottom: 12 },
  sheetTitle: { paddingHorizontal: 20, fontFamily: fonts.displayExtraBold, fontSize: 20, color: "#0F172A" },
  sheetSub: { paddingHorizontal: 20, marginTop: 2, marginBottom: 8, fontFamily: fonts.body, fontSize: 13, color: "#64748B" },
  sheetLoading: { marginVertical: 32 },
  sheetList: { flexGrow: 0 },
  orgRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
});
