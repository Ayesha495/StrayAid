import { Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionExpiredError } from "../../services/apiClient";
import {
  ChatMessage,
  ConversationDetail,
  getConversation,
  getMessages,
  sendMessage,
} from "../../services/chatService";
import { colors, fonts } from "../../theme/tokens";
import { clockTime, dayLabel, timeAgo } from "../../utils/format";
import { pickPhoto, PickedPhoto } from "../../utils/pickPhoto";

// Stitch screen 19: Chat thread. New messages are fetched every few seconds while the
// thread is open (no paid realtime service needed).

const POLL_MS = 4000;
// A new date chip when messages are more than this far apart.
const GAP_MS = 60 * 60 * 1000;
const ACTIVE_MS = 15 * 60 * 1000;

const C = {
  surface: "#F8F9FF",
  container: "#E5EEFF",
  containerHigh: "#DBE9FF",
  primary: "#00523F",
  sent: colors.primary,
  ink: "#0B1C2E",
  inkSoft: "#3F4945",
  mintStrong: "#86F4C8",
  onMint: "#007153",
  secondary: "#006C4F",
  urgent: "#A23E32",
};

const REACTIONS = ["❤️ Relieved!", "🙏 Bless you team"];

function suggestionsFor(detail: ConversationDetail): string[] {
  if (detail.case) {
    const animal = detail.case.title.toLowerCase().includes("cat") ? "the cat" : "the dog";
    return [`Any update on ${animal}?`, "Can I visit today?", "Need donation details?"];
  }
  if (detail.animal) {
    const name = detail.animal.name;
    return [`When can I meet ${name}?`, `Is ${name} vaccinated?`, "What should I bring?"];
  }
  return ["Do you need volunteers?", "How can I donate?", "What are your visiting hours?"];
}

export default function ChatThreadScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lastId = useRef(0);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof SessionExpiredError) router.replace("/auth-sheet");
    else setError(err instanceof Error ? err.message : "We couldn't load this chat.");
  }, []);

  const load = useCallback(async () => {
    try {
      const [info, thread] = await Promise.all([getConversation(conversationId), getMessages(conversationId)]);
      setDetail(info);
      setMessages(thread);
      lastId.current = thread.length ? thread[thread.length - 1].id : 0;
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [conversationId, handleError]);

  const poll = useCallback(async () => {
    try {
      const fresh = await getMessages(conversationId, lastId.current || undefined);
      if (!fresh.length) return;
      lastId.current = fresh[fresh.length - 1].id;
      setMessages((current) => {
        const known = new Set((current ?? []).map((message) => message.id));
        return [...(current ?? []), ...fresh.filter((message) => !known.has(message.id))];
      });
    } catch {
      // Try again on the next tick.
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(poll, POLL_MS);
      return () => clearInterval(timer);
    }, [load, poll])
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/messages" as Href));

  const send = async (text: string, attachment: PickedPhoto | null = null) => {
    if ((!text.trim() && !attachment) || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(conversationId, text, attachment);
      lastId.current = Math.max(lastId.current, message.id);
      setMessages((current) => [...(current ?? []).filter((item) => item.id !== message.id), message]);
      if (text === draft) setDraft("");
      if (attachment) setPhoto(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) router.push("/auth-sheet");
      else Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const attach = async (source: "camera" | "library") => {
    const picked = await pickPhoto(source, "send a photo");
    if (picked) setPhoto(picked);
  };

  const call = () => {
    if (!detail?.phone) {
      Alert.alert(detail?.title ?? "Call", "This organization hasn't added a phone number yet.");
      return;
    }
    Linking.openURL(`tel:${detail.phone.replace(/\s/g, "")}`).catch(() => null);
  };

  const showOptions = () => {
    if (!detail) return;
    Alert.alert(detail.title, undefined, [
      ...(detail.is_organization
        ? [{ text: "View organization", onPress: () => router.push(`/organizations/${detail.organization_id}` as Href) }]
        : []),
      ...(detail.case ? [{ text: "Open case", onPress: () => router.push(`/cases/${detail.case!.id}` as Href) }] : []),
      ...(detail.animal ? [{ text: `View ${detail.animal.name}`, onPress: () => router.push(`/animals/${detail.animal!.id}` as Href) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  // Group the thread: date chips between distant messages, a sender line under the first
  // message from the organization, and a tick on messages it has answered since.
  const rows = useMemo(() => {
    if (!messages) return [];
    const lastFromThem = [...messages].reverse().find((message) => !message.from_me);
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      const showDate = !previous || new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() > GAP_MS;
      const firstOfGroup = showDate || !previous || previous.from_me !== message.from_me;
      const lastOfGroup = !next || next.from_me !== message.from_me;
      const answered = message.from_me && !!lastFromThem && lastFromThem.id > message.id;
      return { message, showDate, firstOfGroup, lastOfGroup, answered };
    });
  }, [messages]);

  if (!detail || !messages) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="dark" />
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={load} style={styles.retry} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const active = detail.last_active ? Date.now() - new Date(detail.last_active).getTime() <= ACTIVE_MS : false;
  const presence = !detail.is_organization
    ? "Community member"
    : active
    ? "Active Now"
    : detail.last_active
    ? `Active ${timeAgo(detail.last_active)}`
    : "Usually replies within a day";
  const lastMessage = messages[messages.length - 1];
  const showReactions = !!detail.case && !!lastMessage && !lastMessage.from_me && detail.is_organization;
  const update = detail.case?.latest_update;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.headerButton}>
            <MaterialIcons name="arrow-back" size={24} color={C.ink} />
          </Pressable>
          <View>
            <View style={styles.headerAvatar}>
              {detail.avatar ? (
                <Image source={{ uri: detail.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : detail.is_organization ? (
                <MaterialCommunityIcons name="shield-account" size={22} color={C.primary} />
              ) : (
                <Text style={styles.headerInitials}>{detail.initials}</Text>
              )}
            </View>
            {active && <View style={styles.headerOnline} />}
          </View>
          <View style={styles.headerText}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
                {detail.title}
              </Text>
              {detail.verified && <MaterialIcons name="verified" size={16} color={C.primary} />}
            </View>
            <View style={styles.presence}>
              {active && <View style={styles.presenceDot} />}
              <Text style={styles.presenceText}>{presence}</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {detail.is_organization && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${detail.title}`} onPress={call} style={styles.headerButton}>
              <MaterialIcons name="call" size={22} color={C.primary} />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={showOptions} style={styles.headerButton}>
            <MaterialIcons name="more-vert" size={22} color={C.inkSoft} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {detail.case && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Case ${detail.case.reference}, ${detail.case.status_label}. Open the case`}
              onPress={() => router.push(`/cases/${detail.case!.id}` as Href)}
              style={styles.pinned}
            >
              <View style={styles.pinnedLeft}>
                <View style={styles.pinnedIcon}>
                  <MaterialIcons name="medical-services" size={20} color={C.primary} />
                </View>
                <View style={styles.flexShrink}>
                  <View style={styles.pinnedTop}>
                    {detail.case.live && <View style={styles.urgentDot} />}
                    <Text style={styles.pinnedRef} numberOfLines={1}>
                      Case #{detail.case.reference}
                    </Text>
                    <Text style={styles.pinnedBadge}>{detail.case.status_label}</Text>
                  </View>
                  <Text style={styles.pinnedSub} numberOfLines={1}>
                    {/* Titles like "Injured Dog — G-11" already name the area. */}
                    {detail.case.area && !detail.case.title.includes(detail.case.area)
                      ? `${detail.case.title} • ${detail.case.area}`
                      : detail.case.title}
                  </Text>
                </View>
              </View>
              <View style={styles.pinnedArrow}>
                <MaterialIcons name="chevron-right" size={18} color={C.primary} />
              </View>
            </Pressable>
          )}
          {detail.animal && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${detail.animal.name}. Open the profile`}
              onPress={() => router.push(`/animals/${detail.animal!.id}` as Href)}
              style={styles.pinned}
            >
              <View style={styles.pinnedLeft}>
                <View style={styles.pinnedIcon}>
                  {detail.animal.image ? (
                    <Image source={{ uri: detail.animal.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <MaterialIcons name="pets" size={20} color={C.primary} />
                  )}
                </View>
                <View style={styles.flexShrink}>
                  <View style={styles.pinnedTop}>
                    <Text style={styles.pinnedRef} numberOfLines={1}>
                      {detail.animal.name}
                    </Text>
                    <Text style={styles.pinnedBadge}>
                      {detail.animal.application_status
                        ? `Application ${detail.animal.application_status}`
                        : detail.animal.status_label}
                    </Text>
                  </View>
                  <Text style={styles.pinnedSub} numberOfLines={1}>
                    {[detail.animal.species, "Adoption & care"].filter(Boolean).join(" • ")}
                  </Text>
                </View>
              </View>
              <View style={styles.pinnedArrow}>
                <MaterialIcons name="chevron-right" size={18} color={C.primary} />
              </View>
            </Pressable>
          )}

          {detail.case && update && (
            <View style={styles.live}>
              <View style={styles.liveLeft}>
                <MaterialIcons name="location-on" size={16} color={C.secondary} />
                <Text style={styles.liveText} numberOfLines={1}>
                  {update.message}
                </Text>
              </View>
              <Text style={styles.liveBadge}>{detail.case.live ? "Live" : timeAgo(update.created_at)}</Text>
            </View>
          )}

          {rows.length === 0 && (
            <View style={styles.emptyThread}>
              <Text style={styles.emptyTitle}>Say hello to {detail.title}</Text>
              <Text style={styles.emptyText}>
                {detail.case
                  ? "Ask about the rescue or share anything that helps the team find the animal."
                  : detail.animal
                  ? `Ask anything about ${detail.animal.name}.`
                  : "Ask a question and the team will reply here."}
              </Text>
            </View>
          )}

          {rows.map(({ message, showDate, firstOfGroup, lastOfGroup, answered }) => (
            <View key={message.id}>
              {showDate && (
                <View style={styles.dateChip}>
                  <Text style={styles.dateText}>{dayLabel(message.created_at)}</Text>
                </View>
              )}
              {message.from_me ? (
                <View style={[styles.sentWrap, !lastOfGroup && styles.tight]}>
                  <View style={[styles.bubble, styles.sentBubble, message.image && styles.mediaBubble]}>
                    {message.image && <Photo uri={message.image} />}
                    {!!message.body && <Text style={[styles.bubbleText, styles.sentText, message.image && styles.mediaText]}>{message.body}</Text>}
                  </View>
                  {lastOfGroup && (
                    <View style={styles.sentMeta}>
                      <Text style={styles.metaText}>{clockTime(message.created_at)}</Text>
                      <MaterialIcons name={answered ? "done-all" : "done"} size={14} color={C.primary} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.receivedWrap, !lastOfGroup && styles.tight]}>
                  <View style={styles.receivedAvatarSlot}>
                    {lastOfGroup && (
                      <View style={styles.receivedAvatar}>
                        {message.from_organization ? (
                          <MaterialIcons name="pets" size={18} color={C.primary} />
                        ) : (
                          <Text style={styles.receivedInitials}>{detail.initials}</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.receivedColumn}>
                    <View style={[styles.bubble, styles.receivedBubble, message.image && styles.mediaBubble]}>
                      {message.image && <Photo uri={message.image} />}
                      {!!message.body && <Text style={[styles.bubbleText, message.image && styles.mediaText]}>{message.body}</Text>}
                    </View>
                    {lastOfGroup && (
                      <View style={styles.receivedMeta}>
                        <Text style={styles.metaText}>
                          {firstOfGroup ? `${message.sender_name} • ` : ""}
                          {clockTime(message.created_at)}
                        </Text>
                        {message.from_organization && detail.verified && !!message.image && (
                          <Text style={styles.verifiedText}>• Verified Response</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}

          {showReactions && (
            <View style={styles.reactions}>
              {REACTIONS.map((reaction) => (
                <Pressable key={reaction} accessibilityRole="button" onPress={() => send(reaction)} style={styles.reaction}>
                  <Text style={styles.reactionText}>{reaction}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
            {suggestionsFor(detail).map((suggestion) => (
              <Pressable key={suggestion} accessibilityRole="button" onPress={() => send(suggestion)} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {photo && (
            <View style={styles.attachment}>
              <Image source={{ uri: photo.uri }} style={styles.attachmentThumb} contentFit="cover" />
              <Text style={styles.attachmentText}>Photo ready to send</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} hitSlop={8}>
                <Feather name="x" size={18} color={C.inkSoft} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Add a photo from the gallery" onPress={() => attach("library")} style={styles.inputButton}>
              <MaterialIcons name="add" size={22} color={C.inkSoft} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" onPress={() => attach("camera")} style={styles.inputButton}>
              <MaterialIcons name="photo-camera" size={20} color={C.inkSoft} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message..."
              placeholderTextColor={C.inkSoft}
              style={styles.input}
              multiline
              maxLength={2000}
              accessibilityLabel="Message"
              onSubmitEditing={() => send(draft, photo)}
              submitBehavior="submit"
              returnKeyType="send"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={sending || (!draft.trim() && !photo)}
              onPress={() => send(draft, photo)}
              style={({ pressed }) => [styles.send, pressed && styles.sendPressed, !draft.trim() && !photo && styles.sendIdle]}
            >
              {sending ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialIcons name="send" size={20} color={colors.onPrimary} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Photo({ uri }: { uri: string }) {
  return (
    <View style={styles.photo}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <LinearGradient colors={["transparent", "rgba(33,49,68,0.6)"]} style={styles.photoShade} pointerEvents="none" />
      <View style={styles.photoLabel}>
        <MaterialIcons name="photo-camera" size={14} color="#EAF1FF" />
        <Text style={styles.photoLabelText}>Photo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(248,249,255,0.95)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.container,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInitials: { fontFamily: fonts.displayBold, fontSize: 14, color: C.primary },
  headerOnline: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.surface,
    backgroundColor: C.mintStrong,
  },
  headerText: { flex: 1, minWidth: 0, marginLeft: 8 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerTitle: { flexShrink: 1, fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 22, color: C.ink },
  presence: { flexDirection: "row", alignItems: "center", gap: 4 },
  presenceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.secondary },
  presenceText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.inkSoft },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  thread: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  pinned: {
    marginBottom: 12,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pinnedLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  pinnedIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: C.containerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  urgentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.urgent },
  pinnedRef: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.ink },
  pinnedBadge: {
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.mintStrong,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    color: C.onMint,
    textTransform: "capitalize",
  },
  pinnedSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.inkSoft },
  pinnedArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.container, alignItems: "center", justifyContent: "center" },
  live: {
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(134,244,200,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  liveLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  liveText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.onMint },
  liveBadge: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, textTransform: "uppercase", color: C.secondary },
  emptyThread: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: C.ink, textAlign: "center" },
  emptyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: C.inkSoft, textAlign: "center" },
  dateChip: {
    alignSelf: "center",
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.container,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.inkSoft },
  tight: { marginBottom: 4 },
  sentWrap: { alignSelf: "flex-end", alignItems: "flex-end", maxWidth: "82%", gap: 4, marginBottom: 12 },
  receivedWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%", marginBottom: 12 },
  receivedAvatarSlot: { width: 32, marginBottom: 22 },
  receivedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.containerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  receivedInitials: { fontFamily: fonts.displayBold, fontSize: 11, color: C.primary },
  receivedColumn: { flexShrink: 1, gap: 4 },
  bubble: {
    padding: 14,
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sentBubble: { backgroundColor: C.sent, borderBottomRightRadius: 2 },
  receivedBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 2 },
  mediaBubble: { padding: 0, overflow: "hidden", width: 260, maxWidth: "100%" },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: C.ink },
  sentText: { color: colors.onPrimary },
  mediaText: { padding: 12 },
  sentMeta: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 },
  receivedMeta: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4, flexWrap: "wrap" },
  metaText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.inkSoft },
  verifiedText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, color: C.primary },
  photo: { height: 176, backgroundColor: C.container },
  photoShade: { ...StyleSheet.absoluteFillObject },
  photoLabel: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 4 },
  photoLabelText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: "#EAF1FF" },
  reactions: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 4 },
  reaction: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reactionText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  composer: { paddingTop: 8, paddingHorizontal: 16, backgroundColor: "rgba(248,249,255,0.95)" },
  suggestions: { gap: 4, paddingBottom: 8 },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.primary },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    padding: 6,
    paddingRight: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  attachmentThumb: { width: 40, height: 40, borderRadius: 10 },
  attachmentText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: C.inkSoft },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: 28,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingHorizontal: 4,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: C.ink,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.sent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendPressed: { transform: [{ scale: 0.95 }] },
  sendIdle: { opacity: 0.6 },
});
