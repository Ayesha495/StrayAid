import { Feather, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CommentAvatar, { AuthorBadge } from "../../../components/post/CommentAvatar";
import { useSession } from "../../../hooks/useSession";
import { SessionExpiredError } from "../../../services/apiClient";
import { FeedPost } from "../../../services/homeService";
import {
  addComment,
  countShare,
  deleteComment,
  getComments,
  getPost,
  PostComment,
  setCommentLiked,
  setPostSaved,
  togglePin,
} from "../../../services/postService";
import { colors, fonts } from "../../../theme/tokens";
import { timeAgo } from "../../../utils/format";

// Stitch screen 23: Comments sheet. It slides up over the feed (like the sign-in sheet) and
// is dismissed by dragging it down, tapping above it or the back button.

const WINDOW = Dimensions.get("window").height;
const SHEET_HEIGHT = Math.round(WINDOW * 0.88);
const DISMISS_DRAG = 120;

const C = {
  surface: "#F8F9FF",
  low: "#EEF4FF",
  container: "#E5EEFF",
  high: "#DBE9FF",
  primary: "#00523F",
  secondary: "#006C4F",
  ink: "#0B1C2E",
  soft: "#3F4945",
  outline: "#BEC9C3",
};

const ANIMAL_STATUS: Record<string, string> = {
  rescued: "Rescued",
  recovering: "Recovering",
  adoptable: "Adoptable",
  adopted: "Adopted",
};

// Quick reactions that start a comment.
const REACTIONS = [
  { emoji: "❤️", label: "Sweet baby" },
  { emoji: "🙏", label: "Bless you" },
  { emoji: "🐾", label: "Get well soon" },
  { emoji: "💖", label: "Sponsoring" },
  { emoji: "🏡", label: "Forever Home" },
];

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [count, setCount] = useState(0);
  const [sort, setSort] = useState<"top" | "new">("top");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const load = useCallback(
    async (order: "top" | "new" = sort) => {
      try {
        const [data, thread] = await Promise.all([getPost(postId), getComments(postId, order)]);
        setPost(data);
        setComments(thread.results);
        setCount(thread.count);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "We couldn't load the comments.");
      }
    },
    [postId, sort]
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [postId])
  );

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  }, [translateY]);

  // Slide the sheet away first, then leave the route (or go somewhere else).
  const close = useCallback(
    (then?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }).start(() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/home");
        then?.();
      });
    },
    [translateY]
  );

  // Drag the top of the sheet down to close it.
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DRAG || gesture.vy > 1.2) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const goTo = (href: Parameters<typeof router.push>[0]) => close(() => router.push(href));
  const requireAccount = (action: () => void) => (isSignedIn ? action() : router.push("/auth-sheet"));

  const showPostOptions = () => {
    if (!post) return;
    Alert.alert(post.organization.name, undefined, [
      { text: post.saved_by_me ? "Remove from saved" : "Save post", onPress: toggleSave },
      { text: "Share post", onPress: share },
      { text: `View ${post.animal.name}`, onPress: () => goTo(`/animals/${post.animal.id}`) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const changeSort = () => {
    const next = sort === "top" ? "new" : "top";
    setSort(next);
    load(next);
  };

  // Updates one comment wherever it is (top level or a reply).
  const patch = (id: number, change: (comment: PostComment) => PostComment | null) =>
    setComments((current) =>
      (current ?? [])
        .map((comment) =>
          comment.id === id
            ? change(comment)
            : { ...comment, replies: comment.replies.map((reply) => (reply.id === id ? change(reply) : reply)).filter(Boolean) as PostComment[] }
        )
        .filter(Boolean) as PostComment[]
    );

  const like = (comment: PostComment) =>
    requireAccount(async () => {
      const liked = !comment.liked_by_me;
      patch(comment.id, (item) => ({ ...item, liked_by_me: liked, like_count: item.like_count + (liked ? 1 : -1) }));
      try {
        const result = await setCommentLiked(comment.id, liked);
        patch(comment.id, (item) => ({ ...item, ...result }));
      } catch {
        patch(comment.id, () => comment);
      }
    });

  const startReply = (comment: PostComment) =>
    requireAccount(() => {
      setReplyTo(comment);
      input.current?.focus();
    });

  const send = () =>
    requireAccount(async () => {
      if (!draft.trim() || sending || !post) return;
      setSending(true);
      try {
        const comment = await addComment(post.id, draft.trim(), replyTo?.id);
        if (replyTo) {
          const parentId = comment && replyTo.id;
          setComments((current) =>
            (current ?? []).map((item) =>
              item.id === parentId || item.replies.some((reply) => reply.id === parentId) ? { ...item, replies: [...item.replies, comment] } : item
            )
          );
        } else {
          setComments((current) => {
            const pinned = (current ?? []).filter((item) => item.is_pinned);
            const rest = (current ?? []).filter((item) => !item.is_pinned);
            return [...pinned, comment, ...rest];
          });
        }
        setCount((value) => value + 1);
        setDraft("");
        setReplyTo(null);
      } catch (err) {
        if (err instanceof SessionExpiredError) router.push("/auth-sheet");
        else Alert.alert("Comment not posted", err instanceof Error ? err.message : "Please try again.");
      } finally {
        setSending(false);
      }
    });

  const commentOptions = (comment: PostComment) => {
    const options = [
      ...(comment.can_pin
        ? [{ text: comment.is_pinned ? "Unpin" : "Pin to top", onPress: () => togglePin(comment.id).then(() => load()) }]
        : []),
      ...(comment.can_delete
        ? [
            {
              text: "Delete",
              style: "destructive" as const,
              onPress: async () => {
                try {
                  await deleteComment(comment.id);
                  patch(comment.id, () => null);
                  setCount((value) => Math.max(0, value - 1 - comment.replies.length));
                } catch (err) {
                  Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Please try again.");
                }
              },
            },
          ]
        : []),
    ];
    if (!options.length) return;
    Alert.alert("Comment", undefined, [...options, { text: "Cancel", style: "cancel" }]);
  };

  const share = async () => {
    if (!post) return;
    const result = await Share.share({ message: `${post.content}\n\n— ${post.organization.name} on StrayAid` }).catch(() => null);
    if (result && result.action !== Share.dismissedAction) countShare(post.id);
  };

  const toggleSave = () =>
    requireAccount(async () => {
      if (!post) return;
      const saved = !post.saved_by_me;
      setPost({ ...post, saved_by_me: saved });
      await setPostSaved(post.id, saved).catch(() => setPost(post));
    });

  if (!post || !comments) {
    // Same outer tree as the loaded sheet, so the slide-in animation carries on when it loads.
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "web" ? undefined : "padding"}>
        <Pressable style={styles.backdrop} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close comments" />
        <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
          <View style={styles.loadingSheet} {...drag.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.centered}>
            {error ? (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => load()} style={styles.retry} accessibilityRole="button">
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  const pinned = comments.find((comment) => comment.is_pinned && comment.author.is_organization);
  const listed = comments.filter((comment) => comment !== pinned);
  const animal = post.animal;
  const organization = post.organization;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "web" ? undefined : "padding"}>
      <Pressable style={styles.backdrop} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close comments" />
      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]} accessibilityViewIsModal>
      <View {...drag.panHandlers}>
        <View style={styles.peekBand}>
          <View style={styles.peekHandle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${animal.name}'s profile`}
            onPress={() => goTo(`/animals/${animal.id}`)}
            style={styles.peek}
          >
            <View style={styles.peekLeft}>
              <View style={styles.peekImage}>
                {post.image && <Image source={{ uri: post.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              </View>
              <View style={styles.flexShrink}>
                <View style={styles.peekNameRow}>
                  <Text style={styles.peekName} numberOfLines={1}>
                    {animal.name}
                    {animal.species ? ` the ${animal.species}` : ""}
                  </Text>
                  <View style={styles.peekDot} />
                </View>
                <Text style={styles.peekSub} numberOfLines={1}>
                  {[organization.name, organization.address || organization.city].filter(Boolean).join(" • ")}
                </Text>
              </View>
            </View>
            <Text style={styles.peekBadge}>{ANIMAL_STATUS[animal.status] ?? "Rescued"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handleArea} {...drag.panHandlers} />
        <View style={styles.sheetHead}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              Comments
            </Text>
            <Text style={styles.countPill}>{count}</Text>
          </View>
          <View style={styles.sheetActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sort === "top" ? "newest" : "top"}`}
            onPress={changeSort}
            style={styles.sortPill}
          >
            <MaterialIcons name="swap-vert" size={16} color={C.primary} />
            <Text style={styles.sortText}>{sort === "top" ? "Top" : "Newest"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={showPostOptions} style={styles.sheetMore}>
            <MaterialIcons name="more-vert" size={20} color={C.soft} />
          </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {pinned && (
            <Pressable onLongPress={() => commentOptions(pinned)} style={styles.pinned}>
              <View style={styles.pinnedTop}>
                <View style={styles.pinnedLabelRow}>
                  <MaterialIcons name="push-pin" size={16} color={C.primary} />
                  <Text style={styles.pinnedLabel}>Pinned by Shelter Author</Text>
                </View>
                <Text style={styles.time}>{timeAgo(pinned.created_at)}</Text>
              </View>
              <View style={styles.pinnedBody}>
                <CommentAvatar author={pinned.author} size={28} />
                <View style={styles.flexShrink}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{pinned.author.name}</Text>
                    {pinned.author.verified && <MaterialIcons name="verified" size={14} color={C.secondary} />}
                  </View>
                  <Text style={styles.pinnedText}>{pinned.body}</Text>
                </View>
              </View>
            </Pressable>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactions} keyboardShouldPersistTaps="handled">
            {REACTIONS.map((reaction) => (
              <Pressable
                key={reaction.label}
                accessibilityRole="button"
                accessibilityLabel={`Start a comment: ${reaction.label}`}
                onPress={() =>
                  requireAccount(() => {
                    setDraft(`${reaction.emoji} ${reaction.label}`);
                    input.current?.focus();
                  })
                }
                style={({ pressed }) => [styles.reaction, pressed && styles.pressed]}
              >
                <Text style={styles.reactionText}>
                  {reaction.emoji} {reaction.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {listed.length === 0 && !pinned && (
            <Text style={styles.empty}>No comments yet. Be the first to cheer {animal.name} on!</Text>
          )}

          {listed.map((comment) => (
            <View key={comment.id} style={styles.thread}>
              <CommentRow comment={comment} onLike={like} onReply={startReply} onMore={commentOptions} />
              {comment.replies.map((reply) => (
                <ReplyRow key={reply.id} reply={reply} onLike={like} onMore={commentOptions} />
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
          {replyTo && (
            <View style={styles.replying}>
              <Text style={styles.replyingText} numberOfLines={1}>
                Replying to {replyTo.author.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} hitSlop={8}>
                <Feather name="x" size={16} color={C.soft} />
              </Pressable>
            </View>
          )}
          <View style={styles.composerRow}>
            <View style={styles.me}>
              <MaterialIcons name="person" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.field}>
              <TextInput
                ref={input}
                value={draft}
                onChangeText={setDraft}
                onFocus={() => !isSignedIn && router.push("/auth-sheet")}
                placeholder={replyTo ? `Reply to ${replyTo.author.name}` : `Add a comment for ${organization.name}`}
                placeholderTextColor={C.soft}
                style={styles.fieldInput}
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={send}
                accessibilityLabel="Comment"
              />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Post comment" disabled={sending} onPress={send} style={[styles.send, !draft.trim() && styles.sendIdle]}>
              {sending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <MaterialIcons name="send" size={20} color={colors.onPrimary} />}
            </Pressable>
          </View>
        </View>
      </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

type RowProps = {
  onLike: (comment: PostComment) => void;
  onMore: (comment: PostComment) => void;
};

function LikeColumn({ comment, onLike, small }: { comment: PostComment; onLike: (comment: PostComment) => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${comment.liked_by_me ? "Unlike" : "Like"} comment, ${comment.like_count} likes`}
      onPress={() => onLike(comment)}
      hitSlop={8}
      style={styles.likeColumn}
    >
      <MaterialIcons
        name={comment.liked_by_me ? "favorite" : "favorite-border"}
        size={small ? 18 : 20}
        color={comment.liked_by_me ? "#A23E32" : C.soft}
      />
      <Text style={[styles.likeCount, comment.liked_by_me && styles.likeCountOn]}>{comment.like_count}</Text>
    </Pressable>
  );
}

function CommentRow({ comment, onLike, onReply, onMore }: RowProps & { comment: PostComment; onReply: (comment: PostComment) => void }) {
  return (
    <Pressable onLongPress={() => onMore(comment)} style={styles.row}>
      <CommentAvatar author={comment.author} />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{comment.author.name}</Text>
          <AuthorBadge badge={comment.author.badge} />
          <Text style={styles.time}>• {timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={styles.body}>{comment.body}</Text>
        <View style={styles.rowActions}>
          <Pressable accessibilityRole="button" onPress={() => onReply(comment)} hitSlop={6}>
            <Text style={styles.rowAction}>Reply</Text>
          </Pressable>
          {(comment.can_delete || comment.can_pin) && (
            <Pressable accessibilityRole="button" onPress={() => onMore(comment)} hitSlop={6}>
              <Text style={styles.rowAction}>More</Text>
            </Pressable>
          )}
        </View>
      </View>
      <LikeColumn comment={comment} onLike={onLike} />
    </Pressable>
  );
}

function ReplyRow({ reply, onLike, onMore }: RowProps & { reply: PostComment }) {
  return (
    <Pressable onLongPress={() => onMore(reply)} style={styles.replyRow}>
      <CommentAvatar author={reply.author} size={28} />
      <View style={styles.replyBubble}>
        <View style={styles.replyTop}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {reply.author.name}
            </Text>
            {reply.author.verified && <MaterialIcons name="verified" size={13} color={C.secondary} />}
            {reply.author.badge === "Author" ? <Text style={styles.authorTag}>Author</Text> : <AuthorBadge badge={reply.author.badge} />}
          </View>
          <Text style={styles.time}>{timeAgo(reply.created_at)}</Text>
        </View>
        <Text style={styles.replyText}>{reply.body}</Text>
      </View>
      <LikeColumn comment={reply} onLike={onLike} small />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetWrap: { height: SHEET_HEIGHT },
  loadingSheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
  flexShrink: { flexShrink: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  peekBand: {
    paddingBottom: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.low,
  },
  peekHandle: { alignSelf: "center", width: 40, height: 4, marginTop: 8, marginBottom: 6, borderRadius: 999, backgroundColor: "rgba(63,73,69,0.25)" },
  peek: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  peekLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  peekImage: { width: 40, height: 40, borderRadius: 12, overflow: "hidden", backgroundColor: C.container },
  peekNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  peekName: { flexShrink: 1, fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24, color: C.ink },
  peekDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.secondary },
  peekSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  peekBadge: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#A7F1D7",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    color: "#002118",
  },
  sheet: {
    flex: 1,
    marginTop: -16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    shadowColor: "#0B1C2E",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  handleArea: { height: 16 },
  handle: { alignSelf: "center", width: 48, height: 4, marginTop: 8, marginBottom: 4, borderRadius: 999, backgroundColor: "rgba(190,201,195,0.6)" },
  sheetActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  sheetMore: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sheetHead: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28, letterSpacing: -0.4, color: C.ink },
  countPill: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.high,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: C.ink,
  },
  sortPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: C.low },
  sortText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  list: { paddingBottom: 16 },
  pinned: { marginHorizontal: 16, marginBottom: 12, padding: 12, gap: 4, borderRadius: 16, backgroundColor: C.low },
  pinnedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pinnedLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pinnedLabel: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: C.primary },
  pinnedBody: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 4 },
  pinnedText: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: C.ink },
  reactions: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  reaction: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.container },
  reactionText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.ink },
  pressed: { transform: [{ scale: 0.95 }] },
  empty: { paddingHorizontal: 16, paddingVertical: 24, fontFamily: fonts.body, fontSize: 13, color: C.soft, textAlign: "center" },
  thread: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", flexShrink: 1 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: C.ink },
  time: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: C.soft },
  body: { marginTop: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: C.ink },
  rowActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  rowAction: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: C.soft },
  likeColumn: { alignItems: "center", gap: 2, paddingTop: 4, minWidth: 28 },
  likeCount: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, color: C.soft },
  likeCountOn: { color: "#A23E32" },
  replyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginLeft: 44 },
  replyBubble: { flex: 1, minWidth: 0, padding: 8, borderRadius: 12, backgroundColor: C.low },
  replyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  replyText: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: C.ink },
  authorTag: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12, color: C.secondary },
  composer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: "#EEF2F7" },
  replying: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.low,
  },
  replyingText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: C.soft },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  me: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  field: { flex: 1, height: 44, borderRadius: 999, backgroundColor: C.low, justifyContent: "center", paddingHorizontal: 14 },
  fieldInput: { height: "100%", fontFamily: fonts.body, fontSize: 13, color: C.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendIdle: { opacity: 0.6 },
});
