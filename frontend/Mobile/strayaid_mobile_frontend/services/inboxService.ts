import { Href } from "expo-router";

import { getToken } from "../utils/tokenStorage";
import { authFetch } from "./apiClient";
import { parseJson } from "./mobileContentService";

// The Notifications screen (Stitch 20) and the unread dots on the home header.

export type NotificationKind = "rescue" | "chat" | "adoption" | "sponsorship" | "community" | "alert";

export type InboxNotification = {
  id: number;
  kind: NotificationKind;
  title: string;
  // Text between ** ** is shown bold.
  body: string;
  data: Record<string, string | number | undefined>;
  unread: boolean;
  created_at: string;
};

export async function getNotifications(unreadOnly = false): Promise<InboxNotification[]> {
  return parseJson(await authFetch(`/api/notifications/${unreadOnly ? "?unread=1" : ""}`));
}

export async function markNotificationRead(id: number) {
  await authFetch(`/api/notifications/${id}/read/`, { method: "POST" }).catch(() => null);
}

export async function markAllNotificationsRead(): Promise<number> {
  const result = await parseJson<{ marked: number }>(await authFetch("/api/notifications/read-all/", { method: "POST" }));
  return result.marked;
}

export async function clearReadNotifications(): Promise<number> {
  const result = await parseJson<{ deleted: number }>(await authFetch("/api/notifications/clear-read/", { method: "POST" }));
  return result.deleted;
}

export type UnreadCounts = { notifications: number; messages: number };

// Signed out (or a dead session) simply means nothing unread.
export async function getUnreadCounts(): Promise<UnreadCounts> {
  if (!(await getToken())) return { notifications: 0, messages: 0 };
  try {
    return await parseJson<UnreadCounts>(await authFetch("/api/notifications/unread-counts/"));
  } catch {
    return { notifications: 0, messages: 0 };
  }
}

// Where a notification (or a tapped push, which carries the same data) leads.
export function notificationTarget(data: Record<string, unknown> | undefined | null): Href | null {
  if (!data) return null;
  if (data.conversation_id) return `/messages/${data.conversation_id}` as Href;
  if (data.application_id && data.type !== "adoption_application") return "/applications" as Href;
  if (data.type === "sponsorship" && data.animal_id) return `/animals/${data.animal_id}/sponsor` as Href;
  if (data.case_id) return `/cases/${data.case_id}` as Href;
  if (data.post_id && data.type === "post_comment") return `/posts/${data.post_id}/comments` as Href;
  if (data.post_id && data.animal_id) return `/animals/${data.animal_id}/posts?post=${data.post_id}` as Href;
  if (data.animal_id) return `/animals/${data.animal_id}` as Href;
  return null;
}
