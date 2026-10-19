import API from "../api/axios";
import type { ChatMessage, ConversationDetail, Inbox } from "../types/api";

type StartChat =
  | { case_id: number; member_id?: number; message?: string }
  | { application_id: number; message?: string }
  | { animal_id: number; message?: string }
  | { organization_id: number; message?: string };

/** Opens (or reopens) a conversation and returns it. */
export const startConversation = async (data: StartChat) =>
  (await API.post<ConversationDetail>("/api/chat/conversations/start/", data)).data;

export const getInbox = async (filter = "", query = "") => {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (query) params.set("q", query);
  return (await API.get<Inbox>(`/api/chat/conversations/${params.size ? `?${params}` : ""}`)).data;
};

export const getConversation = async (id: number | string) =>
  (await API.get<ConversationDetail>(`/api/chat/conversations/${id}/`)).data;

/** The thread (marks it read). With `after`, only messages newer than that id. */
export const getMessages = async (id: number | string, after?: number) =>
  (await API.get<ChatMessage[]>(`/api/chat/conversations/${id}/messages/${after ? `?after=${after}` : ""}`)).data;

export const sendMessage = async (id: number | string, body: string, image?: File | null) => {
  const data = new FormData();
  if (body) data.append("body", body);
  if (image) data.append("image", image);
  return (await API.post<ChatMessage>(`/api/chat/conversations/${id}/messages/`, data)).data;
};
