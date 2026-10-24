import { MaterialIcons } from "@expo/vector-icons";
import { Href, router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeHeader, HomeSearchBar, ReportAnimalButton } from "../../../components/home/HomeTop";
import PostCard from "../../../components/home/PostCard";
import StoriesRow from "../../../components/home/StoriesRow";
import { usePostActions } from "../../../hooks/usePostActions";
import { useSession } from "../../../hooks/useSession";
import { FeedPost, getHomeFeed, getStoryGroups, StoryGroup } from "../../../services/homeService";
import { getUnreadCounts, UnreadCounts } from "../../../services/inboxService";
import { getOrganizationDirectory } from "../../../services/mobileContentService";
import { flushQueue, saveRescueContacts } from "../../../services/offlineQueue";
import { colors, fonts, type } from "../../../theme/tokens";

// Stitch screen 2: the community home feed for guests and signed-in users.

export default function HomeScreen() {
  const { isSignedIn } = useSession();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [unread, setUnread] = useState<UnreadCounts>({ notifications: 0, messages: 0 });

  // Red dots on the header and watched stories, refreshed whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      getUnreadCounts().then(setUnread);
      getStoryGroups()
        .then(setStories)
        .catch(() => null);
      // Reports saved while offline go out now, and rescue numbers are kept for the next time
      // there's no connection.
      if (isSignedIn) flushQueue().catch(() => null);
      getOrganizationDirectory()
        .then((organizations) => saveRescueContacts(organizations))
        .catch(() => null);
    }, [isSignedIn])
  );

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

  const { requireAccount, toggleLike, share, openComments, openOrganization, openAnimal, showOptions } = usePostActions(
    setPosts,
    isSignedIn
  );

  // The search bar opens from the header's search icon and closes again with Cancel.
  const closeSearch = useCallback(() => {
    setSearching(false);
    setQuery("");
  }, []);

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
      {searching && <HomeSearchBar value={query} onChangeText={setQuery} onCancel={closeSearch} />}
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
      <HomeHeader
        hasUnread={unread.notifications > 0}
        onNotificationsPress={() => requireAccount(() => router.push("/notifications" as Href))}
        unreadMessages={unread.messages}
        onMessagesPress={() => requireAccount(() => router.push("/messages" as Href))}
        searching={searching}
        onSearchPress={() => (searching ? closeSearch() : setSearching(true))}
      />
      <FlatList
        data={loading || error ? [] : visiblePosts}
        keyExtractor={(post) => String(post.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => toggleLike(item)}
            onComment={() => openComments(item)}
            onShare={() => share(item)}
            onMore={() => showOptions(item)}
            onOpenAnimal={() => openAnimal(item)}
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

// The story viewer (Stitch 21).
function openStories(group: StoryGroup) {
  router.push(`/stories/${group.category}` as Href);
}

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
