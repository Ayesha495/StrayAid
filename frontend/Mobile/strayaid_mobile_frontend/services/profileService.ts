import { appendFile } from "../utils/formFile";
import type { PickedPhoto } from "../utils/pickPhoto";
import { authFetch } from "./apiClient";
import { parseJson, resolveMediaUrl } from "./mobileContentService";

// Profile and Activity screens (the profile design and Stitch 24).

export type Profile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar: string | null;
  area: string;
  phone: string;
  phone_masked: string;
  field_ready: boolean;
  radius_alerts: boolean;
  alert_radius_km: number;
  member_since: string;
};

export type Level = {
  number: number;
  name: string;
  next_name: string | null;
  next_points: number | null;
  progress: number;
  reports_to_next: number;
};

export type Badge = {
  key: string;
  name: string;
  rule: string;
  icon: string;
  earned: boolean;
  progress: number;
  goal: number;
};

export type Impact = {
  reports: number;
  cases: number;
  rescued: number;
  active_cases: number;
  critical_cases: number;
  in_care: number;
  pledged_pkr: number;
  adoptions: number;
  comments: number;
  points: number;
  level: Level;
  accuracy: number | null;
  badges: Badge[];
  badges_earned: number;
  city: string;
  member_since: string;
  area: string;
};

export type Tone = "green" | "amber" | "red" | "grey" | "blue";

export type ActivityItem = {
  id: string;
  kind: "report" | "rehomed" | "followed_case" | "followed_animal" | "application" | "sponsorship" | "saved";
  date: string;
  title: string;
  subtitle: string;
  status: { label: string; tone: Tone };
  tag: string;
  extra: string;
  image: string | null;
  link: { type: "case" | "animal" | "application" | "sponsor" | "post"; id: number; animal_id?: number };
  search: string;
};

export type ActivityFilter = "all" | "reports" | "followed" | "applications" | "sponsorships" | "saved";

export type Activity = {
  counts: Record<ActivityFilter, number>;
  items: ActivityItem[];
  summary: { reports: number; adoptions: number; pledged_pkr: number; level: Level; city: string };
};

const withAvatar = (profile: Profile): Profile => ({ ...profile, avatar: resolveMediaUrl(profile.avatar) });

export async function getProfile(): Promise<Profile> {
  return withAvatar(await parseJson<Profile>(await authFetch("/auth/me/profile/")));
}

export type ProfileChanges = Partial<
  Pick<Profile, "first_name" | "last_name" | "area" | "phone" | "field_ready" | "radius_alerts">
> & { alert_latitude?: number | null; alert_longitude?: number | null; avatar?: PickedPhoto };

export class ProfileError extends Error {
  fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string>) {
    super(message);
    this.fields = fields;
  }
}

export async function updateProfile(changes: ProfileChanges): Promise<Profile> {
  let init: RequestInit;
  if (changes.avatar) {
    const form = new FormData();
    for (const [key, value] of Object.entries(changes)) {
      if (key !== "avatar" && value !== undefined && value !== null) form.append(key, String(value));
    }
    await appendFile(form, "avatar", changes.avatar);
    init = { method: "PATCH", body: form };
  } else {
    init = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) };
  }
  const response = await authFetch("/auth/me/profile/", init);
  const data = await response.json().catch(() => ({}));
  if (response.ok) return withAvatar(data as Profile);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) fields[key] = Array.isArray(value) ? String(value[0]) : String(value);
  throw new ProfileError(Object.values(fields)[0] ?? "We couldn't save your profile.", fields);
}

export async function getImpact(): Promise<Impact> {
  return parseJson<Impact>(await authFetch("/auth/me/impact/"));
}

export async function getActivity(): Promise<Activity> {
  const data = await parseJson<Activity>(await authFetch("/auth/me/activity/"));
  return { ...data, items: data.items.map((item) => ({ ...item, image: resolveMediaUrl(item.image) })) };
}

// "18.5k", "3,500"
export function compactPkr(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return value.toLocaleString("en-US");
}
