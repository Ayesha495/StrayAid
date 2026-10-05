import { getToken } from "../utils/tokenStorage";
import { API_BASE } from "./apiConfig";
import { MobilePost, normalizePost, resolveMediaUrl } from "./mobileContentService";

export type FeedPost = MobilePost & {
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type Severity = "low" | "medium" | "high" | "critical";

export type TrendingCase = {
  id: number;
  title: string;
  species: string;
  area: string;
  severity: Severity;
  confidence_score: number | null;
  possibly_invalid: boolean;
  status: string;
  status_label: string;
  latitude: number;
  longitude: number;
  image: string | null;
  report_count: number;
  created_at: string;
};

export type Story = {
  id: number;
  category: string;
  image: string | null;
  caption: string;
  created_at: string;
  organization: { id: number; name: string; image: string | null };
};

export type StoryGroup = {
  category: string;
  label: string;
  latest_at: string;
  stories: Story[];
};

export type CommunityStats = {
  rescued_total: number;
  rescued_today: number;
};

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${response.status})`);
  }
  return data as T;
}

// Public endpoints work for guests. When signed in we send the token so the server can
// personalise (e.g. liked_by_me); an expired token is rejected even on public endpoints,
// so retry once as a guest instead of failing the whole screen.
async function getPublic<T>(path: string): Promise<T> {
  const token = await getToken();
  if (token) {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status !== 401) {
      return parse<T>(response);
    }
  }
  return parse<T>(await fetch(`${API_BASE}${path}`));
}

export async function getHomeFeed(): Promise<FeedPost[]> {
  const posts = await getPublic<FeedPost[]>("/api/posts/public-feed/");
  return posts.map((post) => ({ ...post, ...normalizePost(post) }));
}

export async function getTrendingCases(limit = 3): Promise<TrendingCase[]> {
  const cases = await getPublic<TrendingCase[]>(`/api/cases/trending/?limit=${limit}`);
  return cases.map((item) => ({ ...item, image: resolveMediaUrl(item.image) }));
}

export async function getStoryGroups(): Promise<StoryGroup[]> {
  const groups = await getPublic<StoryGroup[]>("/api/posts/stories/");
  return groups.map((group) => ({
    ...group,
    stories: group.stories.map((story) => ({
      ...story,
      image: resolveMediaUrl(story.image),
      organization: { ...story.organization, image: resolveMediaUrl(story.organization.image) },
    })),
  }));
}

export async function getCommunityStats(): Promise<CommunityStats> {
  return getPublic<CommunityStats>("/api/cases/stats/");
}

export async function setPostLiked(postId: number, liked: boolean) {
  const token = await getToken();
  const response = await fetch(`${API_BASE}/api/posts/${postId}/like/`, {
    method: liked ? "POST" : "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parse<{ liked_by_me: boolean; like_count: number }>(response);
}
