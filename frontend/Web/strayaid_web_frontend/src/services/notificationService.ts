import API from "../api/axios";
import type { AppNotification, UnreadCounts } from "../types/api";

export const getUnreadCounts = async () => (await API.get<UnreadCounts>("/api/notifications/unread-counts/")).data;

export const getNotifications = async (unreadOnly = false) =>
  (await API.get<AppNotification[]>(`/api/notifications/${unreadOnly ? "?unread=1" : ""}`)).data;

export const markNotificationRead = async (id: number) => {
  await API.post(`/api/notifications/${id}/read/`);
};

export const markAllNotificationsRead = async () => {
  await API.post("/api/notifications/read-all/");
};

export const clearReadNotifications = async () => {
  await API.post("/api/notifications/clear-read/");
};
