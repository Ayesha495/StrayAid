import { authFetch, optionalAuthFetch } from "./apiClient";
import type { FeedPost } from "./homeService";
import { normalizePost, parseJson, resolveMediaUrl } from "./mobileContentService";

// The post page and comments sheet (Stitch 22 and 23), and marking stories as watched.

export async function getPost(postId: string | number): Promise<FeedPost> {
  const post = await parseJson<FeedPost>(await optionalAuthFetch(`/api/posts/${postId}/`));
  return { ...post, ...normalizePost(post) };
}

export type CommentAuthor = {
  id: number;
  name: string;
  initials: string;
  avatar: string | null;
  // "Author" (the organization), "Adopter", "Reporter", "Donor" or "".
  badge: string;
  is_organization: boolean;
  verified: boolean;
};

export type PostComment = {
  id: number;
  body: string;
  created_at: string;
  is_pinned: boolean;
  author: CommentAuthor;
  like_count: number;
  liked_by_me: boolean;
  replies: PostComment[];
  can_delete: boolean;
  can_pin: boolean;
};

const withAvatars = (comment: PostComment): PostComment => ({
  ...comment,
  author: { ...comment.author, avatar: resolveMediaUrl(comment.author.avatar) },
  replies: comment.replies.map(withAvatars),
});

export async function getComments(postId: string | number, sort: "top" | "new" = "top") {
  const data = await parseJson<{ count: number; results: PostComment[] }>(
    await optionalAuthFetch(`/api/posts/${postId}/comments/?sort=${sort}`)
  );
  return { count: data.count, results: data.results.map(withAvatars) };
}

export async function addComment(postId: string | number, body: string, parent?: number) {
  const response = await authFetch(`/api/posts/${postId}/comments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parent }),
  });
  return withAvatars(await parseJson<PostComment>(response));
}

export async function setCommentLiked(commentId: number, liked: boolean) {
  const response = await authFetch(`/api/posts/comments/${commentId}/like/`, { method: liked ? "POST" : "DELETE" });
  return parseJson<{ liked_by_me: boolean; like_count: number }>(response);
}

export async function togglePin(commentId: number) {
  return parseJson<{ is_pinned: boolean }>(await authFetch(`/api/posts/comments/${commentId}/pin/`, { method: "POST" }));
}

export async function deleteComment(commentId: number) {
  const response = await authFetch(`/api/posts/comments/${commentId}/`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) await parseJson(response);
}

export async function setPostSaved(postId: number, saved: boolean) {
  const response = await authFetch(`/api/posts/${postId}/save/`, { method: saved ? "POST" : "DELETE" });
  return parseJson<{ saved_by_me: boolean }>(response);
}

// Counts a share from the app; failures don't matter to the person sharing.
export async function countShare(postId: number) {
  try {
    const response = await optionalAuthFetch(`/api/posts/${postId}/share/`, { method: "POST" });
    return (await parseJson<{ share_count: number }>(response)).share_count;
  } catch {
    return null;
  }
}

export async function markStorySeen(storyId: number) {
  await authFetch(`/api/posts/stories/${storyId}/seen/`, { method: "POST" }).catch(() => null);
}
