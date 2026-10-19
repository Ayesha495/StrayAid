import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../hooks/useSession";
import { SessionExpiredError } from "../../services/apiClient";
import { sendMessage, startConversation } from "../../services/chatService";
import { getStoryGroups, Story, StoryGroup } from "../../services/homeService";
import { markStorySeen } from "../../services/postService";
import { colors, fonts } from "../../theme/tokens";
import { timeAgo } from "../../utils/format";

// Stitch screen 21: Story viewer. Stories play one after another (5 seconds each); tap the
// right side for the next one, the left side to go back, and hold to pause.

const STORY_MS = 5000;
const HOLD_MS = 220;
const MINT = "#89F7CB";
const ANIMAL_STATUS: Record<string, string> = {
  rescued: "Rescued",
  recovering: "In Recovery",
  adoptable: "Ready for Adoption",
  adopted: "Adopted",
};

type Heart = { id: number; x: number; anim: Animated.Value };

export default function StoryViewerScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { isSignedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [reply, setReply] = useState("");
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const progress = useRef(new Animated.Value(0)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const pressedAt = useRef(0);
  const shown = useRef(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => (shown.current = value));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    getStoryGroups()
      .then((data) => {
        const start = Math.max(0, data.findIndex((group) => group.category === category));
        setGroups(data);
        setGroupIndex(start);
      })
      .catch(() => setGroups([]));
  }, [category]);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home")), []);

  const group = groups?.[groupIndex];
  const story: Story | undefined = group?.stories[storyIndex];

  const next = useCallback(() => {
    if (!groups || !group) return;
    if (storyIndex < group.stories.length - 1) setStoryIndex(storyIndex + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    } else close();
  }, [groups, group, storyIndex, groupIndex, close]);

  const previous = useCallback(() => {
    if (!groups) return;
    if (storyIndex > 0) setStoryIndex(storyIndex - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    } else {
      progress.setValue(0);
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, storyIndex, groupIndex]);

  // Runs the progress bar from wherever it is now to the end, then moves on.
  const play = useCallback(() => {
    running.current?.stop();
    const left = 1 - shown.current;
    running.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_MS * left,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    running.current.start(({ finished }) => finished && next());
  }, [progress, next]);

  const pause = useCallback(() => running.current?.stop(), []);

  // A new story starts from the beginning and is marked as watched.
  useEffect(() => {
    if (!story) return;
    progress.setValue(0);
    shown.current = 0;
    if (!typing) play();
    if (isSignedIn) markStorySeen(story.id);
    return () => running.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    if (typing) pause();
    else if (story) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  const floatHeart = (x: number) => {
    const heart = { id: Date.now() + Math.random(), x, anim: new Animated.Value(0) };
    setHearts((current) => [...current, heart]);
    Animated.timing(heart.anim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      setHearts((current) => current.filter((item) => item.id !== heart.id))
    );
  };

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2200);
  };

  if (!groups || !story || !group) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        {groups ? (
          <>
            <Text style={styles.emptyText}>These stories have ended.</Text>
            <Pressable accessibilityRole="button" onPress={close} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Back to Home</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={MINT} />
        )}
      </View>
    );
  }

  const animal = story.animal;
  const organization = story.organization;
  const helping = animal && animal.status !== "adopted";
  const goal = Math.max(animal?.sponsor_goal ?? 1, 1);
  const percent = animal ? Math.min(100, Math.round((animal.sponsor_count / goal) * 100)) : 0;

  const requireAccount = (action: () => void) => (isSignedIn ? action() : router.push("/auth-sheet"));

  const sendReply = async (text: string) => {
    const message = text.trim();
    if (!message) return;
    requireAccount(async () => {
      try {
        const conversation = await startConversation(animal ? { animalId: animal.id } : { organizationId: organization.id });
        const about = story.headline || story.caption || `${group.label} story`;
        await sendMessage(conversation.id, `Replying to your story “${about}”:\n${message}`);
        setReply("");
        setTyping(false);
        flash(`Sent to ${organization.name}`);
        floatHeart(180);
      } catch (err) {
        if (err instanceof SessionExpiredError) router.push("/auth-sheet");
        else Alert.alert("Couldn't send", err instanceof Error ? err.message : "Please try again.");
      }
    });
  };

  const open = (href: Href) => {
    pause();
    router.push(href);
  };

  const share = () => {
    pause();
    Share.share({
      message: `${story.headline || story.caption || group.label} — ${organization.name} on StrayAid`,
    })
      .catch(() => null)
      .finally(play);
  };

  const showOptions = () => {
    pause();
    Alert.alert(organization.name, undefined, [
      { text: "View organization", onPress: () => open(`/organizations/${organization.id}` as Href) },
      ...(animal ? [{ text: `View ${animal.name}`, onPress: () => open(`/animals/${animal.id}` as Href) }] : []),
      { text: "Cancel", style: "cancel" as const, onPress: play },
    ]);
  };

  const onTapZone = (side: "left" | "right") => {
    if (Date.now() - pressedAt.current > HOLD_MS) {
      play();
      return;
    }
    if (side === "left") previous();
    else {
      running.current?.stop();
      next();
    }
  };

  const quickActions = animal
    ? [
        { key: "proud", label: `❤️ So proud of ${animal.name}!`, onPress: () => sendReply(`❤️ So proud of ${animal.name}!`) },
        ...(helping
          ? [{ key: "support", label: "Support Treatment", strong: true, onPress: () => open(`/animals/${animal.id}/sponsor` as Href) }]
          : []),
        animal.status === "adoptable"
          ? { key: "adopt", label: `🏡 Adopt ${animal.name}`, onPress: () => requireAccount(() => open(`/animals/${animal.id}/adopt` as Href)) }
          : { key: "foster", label: "🏡 Offer Foster", onPress: () => sendReply("🏡 I'd like to offer a foster home. How can I help?") },
      ]
    : [
        { key: "love", label: "❤️ Love this!", onPress: () => sendReply("❤️ Love this!") },
        { key: "bless", label: "🙏 Bless you team", onPress: () => sendReply("🙏 Bless you team") },
      ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {story.image ? (
        <Image source={{ uri: story.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noImage]} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.95)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Tap left to go back, right for the next story, hold anywhere to pause. */}
      <View style={[styles.tapZones, { top: insets.top + 100, bottom: 240 }]}>
        {(["left", "right"] as const).map((side) => (
          <Pressable
            key={side}
            accessibilityRole="button"
            accessibilityLabel={side === "left" ? "Previous story" : "Next story"}
            onPressIn={() => {
              pressedAt.current = Date.now();
              pause();
            }}
            onPressOut={() => onTapZone(side)}
            style={side === "left" ? styles.zoneLeft : styles.zoneRight}
          />
        ))}
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {group.stories.map((item, index) => (
            <View key={item.id} style={styles.bar}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      index < storyIndex
                        ? "100%"
                        : index > storyIndex
                        ? "0%"
                        : progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.author}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${organization.name}, open profile`}
            onPress={() => open(`/organizations/${organization.id}` as Href)}
            style={styles.authorLeft}
          >
            <View>
              {organization.image ? (
                <Image source={{ uri: organization.image }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <MaterialIcons name="pets" size={16} color={colors.primary} />
                </View>
              )}
              <View style={styles.avatarDot} />
            </View>
            <View style={styles.authorText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {organization.name}
                </Text>
                {organization.is_verified && <MaterialIcons name="verified" size={15} color={MINT} />}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.time}>{timeAgo(story.created_at)}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.kind} numberOfLines={1}>
                  {group.label}
                </Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.headerButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={showOptions} style={styles.headerButton}>
              <MaterialIcons name="more-vert" size={24} color={colors.onPrimary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close stories" onPress={close} style={styles.headerButton}>
              <MaterialIcons name="close" size={26} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.chips} pointerEvents="none">
          {animal ? (
            <View style={styles.chipDark}>
              <View style={styles.chipPulse} />
              <Text style={styles.chipText} numberOfLines={1}>
                {[animal.area && `${animal.area} Recovery`, `Update ${animal.update_number}`].filter(Boolean).join(" • ")}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.chipGreen}>
            <MaterialIcons name={animal ? "local-hospital" : "auto-awesome"} size={14} color="#A7F1D7" />
            <Text style={styles.chipGreenText} numberOfLines={1}>
              {animal ? ANIMAL_STATUS[animal.status] ?? group.label : group.label}
            </Text>
          </View>
        </View>
      </View>

      {hearts.map((heart) => (
        <Animated.View
          key={heart.id}
          pointerEvents="none"
          style={[
            styles.heart,
            {
              left: heart.x,
              opacity: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) },
                { scale: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) },
              ],
            },
          ]}
        >
          <MaterialIcons name="favorite" size={36} color={MINT} />
        </Animated.View>
      ))}

      <KeyboardAvoidingView behavior="padding" style={styles.bottomWrap} pointerEvents="box-none">
        <View style={styles.bottom} pointerEvents="box-none">
          <View style={styles.story}>
            <View style={styles.creditRow}>
              {animal && <Text style={styles.updateBadge}>Update #{animal.update_number}</Text>}
              <MaterialIcons name="pets" size={13} color={MINT} />
              <Text style={styles.credit} numberOfLines={1}>
                {organization.name} team
              </Text>
            </View>
            {!!story.headline && <Text style={styles.headline}>{story.headline}</Text>}
            {!!story.caption && <Text style={styles.caption}>{story.caption}</Text>}
          </View>

          {helping && animal && (
            <Pressable accessibilityRole="button" onPress={() => open(`/animals/${animal.id}/sponsor` as Href)} style={styles.fund}>
              <View style={styles.fundTop}>
                <View style={styles.fundLeft}>
                  <MaterialCommunityIcons name="bandage" size={15} color={MINT} />
                  <Text style={styles.fundLabel}>{animal.name}&apos;s care sponsors</Text>
                </View>
                <Text style={styles.fundValue}>
                  {animal.sponsor_count} / {goal} ({percent}%)
                </Text>
              </View>
              <View style={styles.fundBar}>
                <View style={[styles.fundFill, { width: `${percent}%` }]} />
              </View>
            </Pressable>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions} keyboardShouldPersistTaps="handled">
            {quickActions.map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={() => {
                  floatHeart(120 + Math.random() * 120);
                  action.onPress();
                }}
                style={({ pressed }) => [styles.action, "strong" in action && styles.actionStrong, pressed && styles.pressed]}
              >
                {"strong" in action && <MaterialIcons name="favorite-border" size={16} color="#007153" />}
                <Text style={[styles.actionText, "strong" in action && styles.actionTextStrong]}>{action.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
            <View style={styles.input}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                placeholder="Send response or pledge..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={styles.inputText}
                returnKeyType="send"
                onSubmitEditing={() => sendReply(reply)}
                accessibilityLabel={`Reply to ${organization.name}`}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Send reply" onPress={() => sendReply(reply)} hitSlop={8}>
                <MaterialIcons name="send" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={animal ? `Sponsor ${animal.name}` : `Support ${organization.name}`}
              onPress={() => open((animal ? `/animals/${animal.id}/sponsor` : `/organizations/${organization.id}`) as Href)}
              style={styles.round}
            >
              <MaterialIcons name="volunteer-activism" size={22} color={MINT} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share story" onPress={share} style={styles.round}>
              <MaterialIcons name="share" size={22} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {notice && (
        <View style={[styles.notice, { top: insets.top + 120 }]} pointerEvents="none">
          <MaterialIcons name="check-circle" size={16} color={MINT} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const glass = "rgba(255,255,255,0.15)";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#213144" },
  centered: { alignItems: "center", justifyContent: "center", gap: 14 },
  emptyText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: "#EAF1FF" },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
  emptyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
  noImage: { backgroundColor: "#213144" },
  tapZones: { position: "absolute", left: 0, right: 0, flexDirection: "row", zIndex: 1 },
  zoneLeft: { flex: 1 },
  zoneRight: { flex: 2 },
  header: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 4, zIndex: 2 },
  bars: { flexDirection: "row", gap: 6, height: 4 },
  bar: { flex: 1, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.3)" },
  barFill: { height: "100%", backgroundColor: MINT },
  author: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  authorLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  avatarDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#213144",
    backgroundColor: "#00523F",
  },
  authorText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 18, color: colors.onPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  time: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: "rgba(255,255,255,0.7)" },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)" },
  kind: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: MINT },
  headerButtons: { flexDirection: "row", alignItems: "center" },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  chipDark: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  chipPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: MINT },
  chipText: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: colors.onPrimary },
  chipGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(30,107,86,0.8)",
  },
  chipGreenText: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: "#A7F1D7" },
  heart: { position: "absolute", top: "58%", zIndex: 5 },
  bottomWrap: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3 },
  bottom: { gap: 12 },
  story: { paddingHorizontal: 16, gap: 4 },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  updateBadge: {
    overflow: "hidden",
    marginRight: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: MINT,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#002116",
  },
  credit: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: "rgba(255,255,255,0.8)" },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.onPrimary,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.75, color: "rgba(255,255,255,0.9)" },
  fund: { marginHorizontal: 16, padding: 8, gap: 6, borderRadius: 12, backgroundColor: glass },
  fundTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fundLeft: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  fundLabel: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, color: "rgba(255,255,255,0.9)" },
  fundValue: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: MINT },
  fundBar: { height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.25)" },
  fundFill: { height: "100%", borderRadius: 999, backgroundColor: MINT },
  actions: { paddingHorizontal: 16, gap: 4 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  actionStrong: { backgroundColor: "rgba(134,244,200,0.9)" },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.onPrimary },
  actionTextStrong: { color: "#007153" },
  pressed: { transform: [{ scale: 0.95 }] },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: glass,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputText: { flex: 1, height: "100%", fontFamily: fonts.body, fontSize: 14, color: colors.onPrimary },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: glass, alignItems: "center", justifyContent: "center" },
  notice: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 6,
  },
  noticeText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPrimary },
});
