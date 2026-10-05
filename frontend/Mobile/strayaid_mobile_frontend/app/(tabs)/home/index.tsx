import { MaterialIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeHeader, HomeSearchBar, ReportAnimalButton } from "../../../components/home/HomeTop";
import PostCard from "../../../components/home/PostCard";
import StoriesRow from "../../../components/home/StoriesRow";
import { useSession } from "../../../hooks/useSession";
import { FeedPost, getHomeFeed, getStoryGroups, setPostLiked, StoryGroup } from "../../../services/homeService";
import { colors, fonts, type } from "../../../theme/tokens";

// Stitch screen 2: the community home feed for guests and signed-in users.

const SIGN_IN_SHEET = "/auth-sheet" as Href;

export default function HomeScreen() {
  const { isSignedIn } = useSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const [feed, storyGroups] = await Promise.allSettled([getHomeFeed(), getStoryGroups()]);
    if (feed.status === "fulfilled") setPosts(feed.value);
    if (storyGroups.status === "fulfilled") setStories(storyGroups.value);
    setError(feed.status === "rejected" ? "We couldn't load the feed. Check your connection and try again." : null);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const requireAccount = useCallback(
    (action: () => void) => {
      if (isSignedIn) action();
      else router.push(SIGN_IN_SHEET);
    },
    [isSignedIn]
  );

  const toggleLike = useCallback(
    (post: FeedPost) =>
      requireAccount(async () => {
        const liked = !post.liked_by_me;
        setPosts((current) =>
          current.map((item) =>
            item.id === post.id ? { ...item, liked_by_me: liked, like_count: item.like_count + (liked ? 1 : -1) } : item
          )
        );
        try {
          const result = await setPostLiked(post.id, liked);
          setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, ...result } : item)));
        } catch {
          setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
          Alert.alert("Couldn't update like", "Please check your connection and try again.");
        }
      }),
    [requireAccount]
  );

  const sharePost = useCallback((post: FeedPost) => {
    Share.share({ message: `${post.content}\n\n— ${post.organization.name} on StrayAid` }).catch(() => null);
  }, []);

  const openOrganization = useCallback(
    (post: FeedPost) => router.push(`/organizations/${post.organization.id}` as Href),
    []
  );

  const showPostOptions = useCallback(
    (post: FeedPost) =>
      Alert.alert(post.organization.name, undefined, [
        { text: "View organization", onPress: () => openOrganization(post) },
        { text: "Share post", onPress: () => sharePost(post) },
        { text: "Cancel", style: "cancel" },
      ]),
    [openOrganization, sharePost]
  );

  const search = query.trim().toLowerCase();
  const visiblePosts = useMemo(
    () =>
      search
        ? posts.filter((post) =>
            [post.content, post.organization.name, post.organization.city, post.animal?.name]
              .filter(Boolean)
              .some((text) => String(text).toLowerCase().includes(search))
          )
        : posts,
    [posts, search]
  );

  const header = (
    <View>
      <HomeSearchBar value={query} onChangeText={setQuery} />
      {!search && (
        <>
          <ReportAnimalButton onPress={() => requireAccount(() => router.push("/report" as Href))} />
          {stories.length > 0 && (
            <View style={styles.storiesSection}>
              <StoriesRow groups={stories} onOpen={openStories} />
            </View>
          )}
        </>
      )}
    </View>
  );

  const emptyState = loading ? (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.stateText}>Loading the latest rescues…</Text>
    </View>
  ) : error ? (
    <View style={styles.stateBox}>
      <MaterialIcons name="wifi-off" size={28} color={colors.inkMuted} />
      <Text style={styles.stateText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.retryButton}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.stateBox}>
      <MaterialIcons name={search ? "search-off" : "pets"} size={28} color={colors.inkMuted} />
      <Text style={styles.stateText}>
        {search ? `No updates match “${query.trim()}”.` : "No rescue updates yet. Check back soon."}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <HomeHeader hasUnread={false} onNotificationsPress={() => requireAccount(() => null)} />
      <FlatList
        data={loading || error ? [] : visiblePosts}
        keyExtractor={(post) => String(post.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => toggleLike(item)}
            onComment={() => requireAccount(() => null)}
            onShare={() => sharePost(item)}
            onMore={() => showPostOptions(item)}
            onOpenAnimal={() => router.push(`/animals/${item.animal.id}` as Href)}
            onOpenOrganization={() => openOrganization(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

// The story viewer (screen 21) is a separate screen still to be built.
function openStories(_group: StoryGroup) {}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  listContent: { paddingBottom: 24 },
  storiesSection: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  stateBox: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  stateText: { ...type.bodyMd, color: colors.inkMuted, textAlign: "center" },
  retryButton: {
    marginTop: 4,
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primary },
});
