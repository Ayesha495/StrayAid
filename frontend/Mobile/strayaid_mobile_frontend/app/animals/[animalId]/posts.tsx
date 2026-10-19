import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PostCard from "../../../components/home/PostCard";
import { usePostActions } from "../../../components/home/usePostActions";
import { useSession } from "../../../hooks/useSession";
import { optionalAuthFetch } from "../../../services/apiClient";
import { FeedPost } from "../../../services/homeService";
import { normalizePost, parseJson } from "../../../services/mobileContentService";
import { colors, fonts } from "../../../theme/tokens";

// An animal's posts as a feed, opened from the photo grid on its profile: it starts at the
// post that was tapped and scrolls through the rest, like the home feed.

async function getAnimalFeed(animalId: string): Promise<FeedPost[]> {
  const posts = await parseJson<FeedPost[]>(await optionalAuthFetch(`/api/posts/?animal=${animalId}`));
  return posts.map((post) => ({ ...post, ...normalizePost(post) }));
}

export default function AnimalPostsScreen() {
  const { animalId, post: startId } = useLocalSearchParams<{ animalId: string; post?: string }>();
  const { isSignedIn } = useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const list = useRef<FlatList<FeedPost>>(null);
  const scrolled = useRef(false);
  const { toggleLike, share, openComments, openOrganization, showOptions } = usePostActions(
    setPosts as React.Dispatch<React.SetStateAction<FeedPost[]>>,
    isSignedIn
  );

  const load = useCallback(async () => {
    try {
      setPosts(await getAnimalFeed(animalId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load these posts.");
    }
  }, [animalId]);

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

  // Jump to the post that was tapped once every post above it has been measured.
  const heights = useRef<Record<number, number>>({});
  const measured = (postId: number, height: number) => {
    heights.current[postId] = height;
    if (scrolled.current || !posts || !startId) return;
    const index = posts.findIndex((post) => String(post.id) === startId);
    const above = posts.slice(0, Math.max(index, 0));
    if (above.some((post) => heights.current[post.id] === undefined)) return;
    scrolled.current = true;
    const offset = above.reduce((total, post) => total + heights.current[post.id], 0);
    if (offset > 0) requestAnimationFrame(() => list.current?.scrollToOffset({ offset, animated: false }));
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/animals/${animalId}`));
  const name = posts?.[0]?.animal?.name;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}>
          <MaterialIcons name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>{name ? name.toUpperCase() : "POSTS"}</Text>
          <Text style={styles.title} accessibilityRole="header">
            Posts
          </Text>
        </View>
        <View style={styles.back} />
      </View>
      {!posts ? (
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
        <FlatList
          ref={list}
          data={posts}
          keyExtractor={(post) => String(post.id)}
          renderItem={({ item }) => (
            <View onLayout={(event) => measured(item.id, event.nativeEvent.layout.height)}>
            <PostCard
              post={item}
              onLike={() => toggleLike(item)}
              onComment={() => openComments(item)}
              onShare={() => share(item)}
              onMore={() => showOptions(item)}
              onOpenAnimal={goBack}
              onOpenOrganization={() => openOrganization(item)}
            />
            </View>
          )}
          initialNumToRender={20}
          ListEmptyComponent={<Text style={styles.stateText}>No posts about this animal yet.</Text>}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  titleWrap: { alignItems: "center" },
  eyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, color: colors.inkMuted },
  title: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  list: { paddingBottom: 32 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateText: { padding: 24, fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: "center" },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPrimary },
});
