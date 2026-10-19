import { appendFile } from "../utils/formFile";
import type { PickedPhoto } from "../utils/pickPhoto";
import { authFetch } from "./apiClient";
import { parseJson, resolveMediaUrl } from "./mobileContentService";

// Messages with rescue organizations (Stitch 18 and 19).

export type ChatFilter = "all" | "shelters" | "rescues" | "adoptions";

export type Conversation = {
  id: number;
  topic: "shelter" | "rescue" | "adoption";
  title: string;
  avatar: string | null;
  initials: string;
  verified: boolean;
  is_organization: boolean;
  tag: { label: string; tone: "amber" | "green" | "grey" } | null;
  last_message: { body: string; has_image: boolean; from_me: boolean; created_at: string } | null;
  unread_count: number;
  active: boolean;
  last_message_at: string;
};

export type ConversationDetail = Conversation & {
  phone: string;
  last_active: string | null;
  organization_id: number;
  case: {
    id: number;
    reference: string;
    status: string;
    status_label: string;
    title: string;
    area: string;
    severity: string;
    live: boolean;
    latest_update: { message: string; created_at: string } | null;
  } | null;
  animal: {
    id: number;
    name: string;
    species: string;
    status: string;
    status_label: string;
    image: string | null;
    application_status: string | null;
  } | null;
};

export type ChatMessage = {
  id: number;
  body: string;
  image: string | null;
  created_at: string;
  from_me: boolean;
  from_organization: boolean;
  sender_name: string;
};

export type Inbox = { results: Conversation[]; total: number; response_minutes: number | null };

const withMedia = <T extends { avatar: string | null }>(item: T): T => ({ ...item, avatar: resolveMediaUrl(item.avatar) });

export async function getInbox(filter: ChatFilter, query: string): Promise<Inbox> {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query.trim()) params.set("q", query.trim());
  const inbox = await parseJson<Inbox>(await authFetch(`/api/chat/conversations/?${params}`));
  return { ...inbox, results: inbox.results.map(withMedia) };
}

export async function getConversation(id: string | number): Promise<ConversationDetail> {
  const detail = await parseJson<ConversationDetail>(await authFetch(`/api/chat/conversations/${id}/`));
  return {
    ...withMedia(detail),
    animal: detail.animal ? { ...detail.animal, image: resolveMediaUrl(detail.animal.image) } : null,
  };
}

// Opens the chat about a case, an animal or with an organization; the server reuses an existing one.
export async function startConversation(about: { caseId?: number; animalId?: number; organizationId?: number }) {
  const response = await authFetch("/api/chat/conversations/start/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: about.caseId, animal_id: about.animalId, organization_id: about.organizationId }),
  });
  return parseJson<ConversationDetail>(response);
}

const withImage = (message: ChatMessage): ChatMessage => ({ ...message, image: resolveMediaUrl(message.image) });

export async function getMessages(conversationId: string | number, afterId?: number): Promise<ChatMessage[]> {
  const query = afterId ? `?after=${afterId}` : "";
  const messages = await parseJson<ChatMessage[]>(await authFetch(`/api/chat/conversations/${conversationId}/messages/${query}`));
  return messages.map(withImage);
}

export async function sendMessage(conversationId: string | number, body: string, photo?: PickedPhoto | null) {
  const form = new FormData();
  if (body.trim()) form.append("body", body.trim());
  if (photo) await appendFile(form, "image", photo);
  const response = await authFetch(`/api/chat/conversations/${conversationId}/messages/`, { method: "POST", body: form });
  return withImage(await parseJson<ChatMessage>(response));
}

export type ChatOrganization = { id: number; name: string; city: string; verified: boolean; image: string | null };

export async function getOrganizationsToMessage(): Promise<ChatOrganization[]> {
  const rows = await parseJson<ChatOrganization[]>(await authFetch("/api/chat/organizations/"));
  return rows.map((row) => ({ ...row, image: resolveMediaUrl(row.image) }));
}
