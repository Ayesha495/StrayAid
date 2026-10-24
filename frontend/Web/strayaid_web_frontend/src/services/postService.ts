import API, { PublicAPI } from "../api/axios";
import { getStoredUser } from "./authService";
import { normalizePost } from "../utils/media";
import type { Post } from "../types/platform";
import type { PostComment, Story, StoryGroup } from "../types/api";

// Signed in, the feed says what you liked and saved; as a guest it's the plain public feed.
const reader = () => (getStoredUser() ? API : PublicAPI);

export const getFeed = async () => (await reader().get<Post[]>("/api/posts/public-feed/")).data.map(normalizePost);

export const getSavedPosts = async () => (await API.get<Post[]>("/api/posts/saved/")).data.map(normalizePost);

export const createPost = async (data: FormData) => normalizePost((await API.post<Post>("/api/posts/", data)).data);

export const updatePost = async (id: number, data: FormData) => normalizePost((await API.patch<Post>(`/api/posts/${id}/`, data)).data);

export const deletePost = async (id: number) => {
  await API.delete(`/api/posts/${id}/`);
};

type LikeResult = { liked_by_me: boolean; like_count: number };

// POST likes or saves, DELETE takes it back.
const toggle = async <T,>(url: string, on: boolean) => (on ? await API.post<T>(url) : await API.delete<T>(url)).data;

export const setPostLiked = (id: number, liked: boolean) => toggle<LikeResult>(`/api/posts/${id}/like/`, liked);

export const setPostSaved = async (id: number, saved: boolean) => {
  await toggle(`/api/posts/${id}/save/`, saved);
};

export const sharePost = async (id: number) => (await PublicAPI.post<{ share_count: number }>(`/api/posts/${id}/share/`)).data;

export const getComments = async (postId: number) =>
  (await reader().get<{ count: number; results: PostComment[] }>(`/api/posts/${postId}/comments/`)).data;

export const addComment = async (postId: number, body: string, parent?: number) =>
  (await API.post<PostComment>(`/api/posts/${postId}/comments/`, { body, parent })).data;

export const deleteComment = async (id: number) => {
  await API.delete(`/api/posts/comments/${id}/`);
};

export const setCommentLiked = (id: number, liked: boolean) => toggle<LikeResult>(`/api/posts/comments/${id}/like/`, liked);

/** Pins the comment (or unpins it if it was pinned); only one comment per post is pinned. */
export const togglePinComment = async (id: number) => (await API.post<{ is_pinned: boolean }>(`/api/posts/comments/${id}/pin/`)).data;

export const getStories = async () => (await reader().get<StoryGroup[]>("/api/posts/stories/")).data;

export const markStorySeen = async (id: number) => {
  await API.post(`/api/posts/stories/${id}/seen/`);
};

/** Organizations share a 24-hour story (category, image, headline, caption, animal_id). */
export const createStory = async (data: FormData) => (await API.post<Story>("/api/posts/stories/", data)).data;
