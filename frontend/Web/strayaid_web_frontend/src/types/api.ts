// Types for the API areas the first web version didn't use yet
// (notifications, chat, applications, funds, community, case history).

export type NotificationKind = "rescue" | "chat" | "adoption" | "sponsorship" | "community" | "alert";

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  /** Markdown-ish: names are wrapped in **double asterisks**. */
  body: string;
  data: Record<string, string | number | null | undefined>;
  unread: boolean;
  created_at: string;
}

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

/** The public case page payload, which also carries the AI score breakdown. */
export interface PublicCase {
  id: number;
  title: string;
  species: string;
  area: string;
  severity: string;
  confidence_score: number | null;
  possibly_invalid: boolean;
  status: string;
  status_label: string;
  image: string | null;
  created_at: string;
  reference: string;
  description: string;
  organization: { id: number; name: string; type?: string; city?: string; phone?: string; email?: string; image?: string | null } | null;
  animal: { id: number; name: string; status?: string; image?: string | null } | null;
  update_count: number;
  latest_update_at: string | null;
  keep_updated: boolean;
  is_reporter: boolean;
  ai: CaseAi;
}

export interface CaseAi {
  model: string;
  scored: boolean;
  animal_confidence: number | null;
  animal: string | null;
  box: number[] | null;
  image: string | null;
  photo_confidence: number | null;
  photo_count: number;
  severity_weight: number;
  report_count: number;
  report_weight: number;
  hours_unanswered: number;
  answered: boolean;
  freshness: number;
  my_feedback?: unknown;
}

export interface CaseUpdate {
  id: number;
  status: string;
  status_label: string;
  message: string;
  author_name: string | null;
  created_at: string;
}

export interface PublicReport {
  id: number;
  image: string | null;
  description: string;
  severity: string;
  created_at: string;
  reporter: string;
  is_mine: boolean;
}

export interface ConversationSummary {
  id: number;
  topic: "rescue" | "adoption" | "shelter";
  title: string;
  avatar: string | null;
  initials: string;
  verified: boolean;
  is_organization: boolean;
  tag: { label: string; tone: string } | null;
  last_message: { body: string; has_image: boolean; from_me: boolean; created_at: string } | null;
  unread_count: number;
  active: boolean;
  last_message_at: string;
}

export interface AnimalSummary {
  id: number;
  name: string;
  species: string;
  status: string;
  image: string | null;
  organization?: { id: number; name: string } | null;
}

export type ReviewStatus = "pending" | "approved" | "rejected" | "withdrawn" | "confirmed";

export interface AdoptionApplication {
  id: number;
  animal: AnimalSummary;
  animal_name: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  created_at: string;
  decided_at: string | null;
  full_name: string;
  phone: string;
  home_type: "apartment" | "house" | "other";
  has_other_pets: boolean;
  city: string;
  ownership: "own" | "rent" | "";
  landlord_allows_pets: boolean | null;
  household_size: number | null;
  has_children: boolean;
  hours_alone: number | null;
  experience: "first_time" | "some" | "experienced" | "";
  reason: string;
  care_plan: string;
  agrees_home_visit: boolean;
  agrees_return_policy: boolean;
}

export interface Sponsorship {
  id: number;
  animal: AnimalSummary;
  sponsor_name?: string;
  amount_pkr: number;
  monthly: boolean;
  receipt: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
}

export interface ShelterDonation {
  id: number;
  donor_name: string;
  organization: { id: number; name: string };
  amount_pkr: number;
  receipt: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
}

export interface OrganizationProfileStats {
  stats: { rescued: number; adopted: number; in_care: number; followers: number; active_cases: number };
  fund: { month: string; goal_pkr: number; raised_pkr: number; percent: number };
  type: string;
  is_available: boolean;
  following: boolean;
  my_pending_donation: boolean;
}

export interface ConversationDetail extends ConversationSummary {
  phone: string;
  last_active: string | null;
  case: { id: number; reference: string; status: string; status_label: string; title: string; area: string; severity: string; live: boolean } | null;
  animal: { id: number; name: string; species?: string; status?: string; image?: string | null } | null;
  organization_id: number;
}

export interface ChatMessage {
  id: number;
  body: string;
  image: string | null;
  created_at: string;
  from_me: boolean;
  from_organization: boolean;
  sender_name: string;
}

export interface Inbox {
  results: ConversationSummary[];
  total: number;
  response_minutes: number | null;
}

export interface PostComment {
  id: number;
  body: string;
  created_at: string;
  is_pinned: boolean;
  author: { id: number; name: string; initials: string; avatar: string | null; badge: string; is_organization: boolean; verified: boolean };
  like_count: number;
  liked_by_me: boolean;
  replies: PostComment[];
  can_delete: boolean;
  can_pin: boolean;
}

export interface Story {
  id: number;
  category: string;
  image: string;
  headline: string;
  caption: string;
  organization: { id: number; name: string; image: string | null; is_verified: boolean };
  animal: { id: number; name: string; species: string; status: string; area: string; sponsor_count: number; sponsor_goal: number; funding_goal_pkr?: number; raised_pkr?: number; update_number: number } | null;
  seen: boolean;
  created_at: string;
}

export interface StoryGroup {
  category: string;
  label: string;
  latest_at: string;
  seen: boolean;
  stories: Story[];
}

export interface DirectoryOrganization {
  id: number;
  name: string;
  city: string;
  address: string;
  image: string | null;
  is_verified: boolean;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  phone: string;
}

export interface AdoptionForm {
  full_name: string;
  phone: string;
  home_type: string;
  has_other_pets: boolean;
  city: string;
  ownership: string;
  landlord_allows_pets: boolean | null;
  household_size: number | "";
  has_children: boolean;
  hours_alone: number | "";
  experience: string;
  reason: string;
  care_plan: string;
  agrees_home_visit: boolean;
  agrees_return_policy: boolean;
}
