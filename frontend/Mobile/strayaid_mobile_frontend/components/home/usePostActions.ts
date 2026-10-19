import { Href, router } from "expo-router";
import { Dispatch, SetStateAction, useCallback } from "react";
import { Alert, Share } from "react-native";

import { FeedPost, setPostLiked } from "../../services/homeService";
import { countShare } from "../../services/postService";

// What you can do with a post card, shared by the home feed and an animal's posts.

export function usePostActions(setPosts: Dispatch<SetStateAction<FeedPost[]>>, isSignedIn: boolean) {
  const requireAccount = useCallback(
    (action: () => void) => (isSignedIn ? action() : router.push("/auth-sheet" as Href)),
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
    [requireAccount, setPosts]
  );

  const share = useCallback(
    async (post: FeedPost) => {
      const result = await Share.share({
        message: `${post.animal?.name ? `${post.animal.name}: ` : ""}${post.content}\n\n— ${post.organization.name} on StrayAid`,
      }).catch(() => null);
      if (result && result.action !== Share.dismissedAction) {
        const count = await countShare(post.id);
        if (count !== null) setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, share_count: count } : item)));
      }
    },
    [setPosts]
  );

  // The comments sheet slides up over the feed (Stitch 23).
  const openComments = useCallback((post: FeedPost) => router.push(`/posts/${post.id}/comments` as Href), []);

  const openOrganization = useCallback((post: FeedPost) => router.push(`/organizations/${post.organization.id}` as Href), []);

  const openAnimal = useCallback((post: FeedPost) => router.push(`/animals/${post.animal.id}` as Href), []);

  const showOptions = useCallback(
    (post: FeedPost) =>
      Alert.alert(post.organization.name, undefined, [
        { text: `View ${post.animal.name}`, onPress: () => openAnimal(post) },
        { text: "View organization", onPress: () => openOrganization(post) },
        { text: "Share post", onPress: () => share(post) },
        { text: "Cancel", style: "cancel" },
      ]),
    [openAnimal, openOrganization, share]
  );

  return { requireAccount, toggleLike, share, openComments, openOrganization, openAnimal, showOptions };
}
