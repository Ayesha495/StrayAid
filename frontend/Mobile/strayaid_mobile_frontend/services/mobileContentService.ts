import { authFetch, optionalAuthFetch } from "./apiClient";
import { appendFile } from "../utils/formFile";
import { API_BASE } from "./apiConfig";

export const resolveMediaUrl = (value: string | null | undefined) => {
  // The API can return relative media paths during local development.
  if (!value) {
    return value ?? null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(value, API_BASE).toString();
};

export type MobileOrganization = {
  id: number;
  name: string;
  description?: string;
  image?: string | null;
  address?: string;
  city?: string;
  capacity?: number;
  radius?: number;
  phone_number?: string;
  contact_email?: string;
  bank_name?: string;
  bank_account_title?: string;
  bank_account_number?: string;
  user_email?: string;
  is_verified?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  tax_id?: string;
};
export type MobileUser = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
};
export type MobileAnimal = {
  id: number;
  name: string;
  species?: string;
  breed?: string;
  gender?: string;
  age?: number | null;
  color?: string;
  description: string;
  medical_info: string;
  // Bank details for sponsoring, and how to reach the organization about adopting.
  donation_info: { bank: string; account_name: string; account_number: string } | null;
  adoption_info: { message: string; phone: string; email: string } | null;
  status: "rescued" | "recovering" | "adoptable" | "adopted" | string;
  image: string | null;
  organization: MobileOrganization;
  created_at: string;
  case_id?: number;
  // Profile page extras (Stitch 13).
  health?: "healthy" | "minor_issues" | "under_treatment" | "special_needs" | "";
  vaccinated?: boolean;
  photos?: string[];
  sponsor_count?: number;
  application_count?: number;
  ai_verified?: boolean;
  // The signed-in viewer's own active application, if any.
  my_application?: { id: number; status: "pending" | "approved" } | null;
  // Sponsor screen (Stitch 16).
  sponsor_goal?: number;
  sponsor_initials?: string[];
  my_sponsorship?: { id: number; status: "pending" | "confirmed"; amount_pkr: number; monthly: boolean } | null;
  // Where it was found, e.g. "G-11".
  area?: string;
};
export type MobilePost = {
  id: number;
  category?: string;
  title: string;
  content: string;
  image: string | null;
  created_at: string;
  animal: MobileAnimal;
  organization: MobileOrganization;
};
export type MobileReport = {
  id: number;
  image?: string | null;
  description: string;
  latitude: number;
  longitude: number;
  created_at: string;
  user_email?: string;
};
export type MobileCase = {
  id: number;
  reference?: string;
  title?: string;
  area?: string;
  species?: string;
  severity?: "low" | "medium" | "high" | "critical";
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  status_label?: string;
  update_count?: number;
  organization?: MobileOrganization | null;
  created_at: string;
  updated_at?: string;
  reports: MobileReport[];
};

// API errors come back as {"error": ...}, {"detail": ...} or {field: [messages]}; show the
// first readable message instead of raw JSON.
function errorMessage(data: unknown, status: number) {
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const first = record.error ?? record.detail ?? Object.values(record)[0];
    const message = Array.isArray(first) ? first[0] : first;
    if (typeof message === "string" && message) return message;
  }
  if (status === 401) return "Please sign in again to continue.";
  return "Something went wrong. Please try again.";
}

// A request the server answered with an error. `code` is the API's machine-readable reason
// ("not_an_animal", "detector_unavailable", ...) when it gives one, so screens can react to
// what actually went wrong instead of guessing from the wording.
export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data && typeof data === "object" && typeof data.code === "string" ? data.code : null;
    throw new ApiError(errorMessage(data, response.status), response.status, code);
  }
  return data as T;
}

// Normalizers keep screen components from worrying about media URL cleanup.
const normalizeOrganization = (organization: MobileOrganization): MobileOrganization => ({
  ...organization,
  image: resolveMediaUrl(organization.image),
});

const normalizeAnimal = (animal: MobileAnimal): MobileAnimal => ({
  ...animal,
  image: resolveMediaUrl(animal.image),
  photos: (animal.photos ?? []).map((photo) => resolveMediaUrl(photo)).filter((photo): photo is string => !!photo),
  organization: normalizeOrganization(animal.organization),
});

export const normalizePost = (post: MobilePost): MobilePost => ({
  ...post,
  image: resolveMediaUrl(post.image),
  animal: normalizeAnimal(post.animal),
  organization: normalizeOrganization(post.organization),
});

export async function getPublicFeed() {
  const response = await fetch(`${API_BASE}/api/posts/public-feed/`);
  return (await parseJson<MobilePost[]>(response)).map(normalizePost);
}

export async function getPublicAnimals() {
  // Signed in, each animal also says whether you sponsor it or applied to adopt it.
  const response = await optionalAuthFetch(`/api/animals/public/`);
  return (await parseJson<MobileAnimal[]>(response)).map(normalizeAnimal);
}

export async function getMyReports() {
  const response = await authFetch(`/api/cases/my-reports/`);
  const cases = await parseJson<MobileCase[]>(response);
  return cases.map((item) => ({
    ...item,
    organization: item.organization ? normalizeOrganization(item.organization) : null,
    reports: item.reports.map((report) => ({ ...report, image: resolveMediaUrl(report.image) })),
  }));
}

export async function getCurrentUser() {
  const response = await authFetch(`/auth/me/`);
  return parseJson<MobileUser>(response);
}

export async function getMyOrganizationProfile() {
  const response = await authFetch(`/api/organizations/me/`);
  return normalizeOrganization(await parseJson<MobileOrganization>(response));
}

export async function getAnimal(animalId: string | number) {
  // Signed in, the response also says whether you've applied to adopt this animal.
  const response = await optionalAuthFetch(`/api/animals/${animalId}/`);
  return normalizeAnimal(await parseJson<MobileAnimal>(response));
}

export async function getAdoptableAnimals() {
  const response = await fetch(`${API_BASE}/api/animals/public/?status=adoptable`);
  return (await parseJson<MobileAnimal[]>(response)).map(normalizeAnimal);
}

// The adoption form (Stitch 14).
export type AdoptionForm = {
  full_name: string;
  phone: string;
  home_type: "apartment" | "house" | "other";
  has_other_pets: boolean;
  city: string;
  ownership: "own" | "rent";
  landlord_allows_pets: boolean | null;
  household_size: number;
  has_children: boolean;
  hours_alone: number;
  experience: "first_time" | "some" | "experienced";
  reason: string;
  care_plan: string;
  agrees_home_visit: boolean;
  agrees_return_policy: boolean;
};

export class AdoptionError extends Error {
  fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}

export async function applyToAdopt(animalId: number, form: AdoptionForm) {
  const response = await authFetch(`/api/animals/${animalId}/apply/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data as { id: number; status: string };
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (key !== "detail") fields[key] = Array.isArray(value) ? String(value[0]) : String(value);
  }
  throw new AdoptionError(data?.detail ?? Object.values(fields)[0] ?? "We couldn't send your application.", fields);
}

export async function getAnimalPosts(animalId: string | number) {
  const response = await fetch(`${API_BASE}/api/posts/by-animal/?animal_id=${animalId}`);
  return (await parseJson<MobilePost[]>(response)).map(normalizePost);
}

export async function getOrganization(organizationId: string | number) {
  const response = await fetch(`${API_BASE}/api/organizations/${organizationId}/`);
  return normalizeOrganization(await parseJson<MobileOrganization>(response));
}

export async function getOrganizationAnimals(organizationId: string | number) {
  const response = await fetch(`${API_BASE}/api/organizations/${organizationId}/animals/`);
  return (await parseJson<MobileAnimal[]>(response)).map(normalizeAnimal);
}

export async function getMyFollows(): Promise<{ followed_animals: number[]; followed_organizations: number[] }> {
  const response = await authFetch(`/api/notifications/my-follows/`);
  return parseJson(response);
}

export type SubmittedReport = {
  message: string;
  case_id: number;
  report_id: number;
  keep_updated: boolean;
  case: {
    id: number;
    reference: string;
    area: string;
    severity: "low" | "medium" | "high" | "critical";
    // 0-100, or null until the image detector has scored the case.
    confidence_score: number | null;
    status: string;
  };
};

// Checks a report photo for an animal before the report is filled in (Stitch 7).
// Resolves when the photo shows an animal; anything else throws (ApiError with a code, a
// network TypeError, or PhotoCheckTimeout), and utils/photoProblems.ts explains it.
export type PhotoCheckResult = { animal: string; confidence: number };

export class PhotoCheckTimeout extends Error {
  constructor() {
    super("Checking the photo took too long.");
    this.name = "PhotoCheckTimeout";
  }
}

// The first check after the server starts loads the AI model (~15 s), so allow for that
// plus a slow upload before giving up.
const PHOTO_CHECK_TIMEOUT_MS = 45000;

export async function checkReportPhoto(photo: { uri: string; name: string; type: string }): Promise<PhotoCheckResult> {
  const form = new FormData();
  await appendFile(form, "image", photo);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_CHECK_TIMEOUT_MS);
  let response: Response;
  try {
    response = await authFetch("/api/cases/check-photo/", { method: "POST", body: form, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new PhotoCheckTimeout();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return parseJson<PhotoCheckResult>(response);
}

export async function submitReport(formData: FormData) {
  const response = await authFetch("/api/cases/report/", { method: "POST", body: formData });
  return parseJson<SubmittedReport>(response);
}

// The success screen's "Keep Me Updated": status pushes for this report.
export async function keepMeUpdated(reportId: number) {
  const response = await authFetch(`/api/cases/reports/${reportId}/keep-updated/`, { method: "POST" });
  return parseJson<{ keep_updated: boolean }>(response);
}

// "My Applications" (Stitch 15).
export type ApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type MyApplication = AdoptionForm & {
  id: number;
  status: ApplicationStatus;
  created_at: string;
  decided_at: string | null;
  animal: {
    id: number;
    name: string;
    species: string;
    status: string;
    image: string | null;
    organization: { id: number; name: string; city: string } | null;
  };
};

export async function getMyApplications(): Promise<MyApplication[]> {
  const rows = await parseJson<MyApplication[]>(await authFetch("/api/animals/applications/"));
  return rows.map((row) => ({ ...row, animal: { ...row.animal, image: resolveMediaUrl(row.animal.image) } }));
}

export async function withdrawApplication(id: number): Promise<MyApplication> {
  const row = await parseJson<MyApplication>(await authFetch(`/api/animals/applications/${id}/withdraw/`, { method: "POST" }));
  return { ...row, animal: { ...row.animal, image: resolveMediaUrl(row.animal.image) } };
}

// Pledging support with the transfer receipt (Stitch 16).
export async function pledgeSupport(
  animalId: number,
  pledge: { amount: number; monthly: boolean; receipt: { uri: string; name: string; type: string } }
) {
  const form = new FormData();
  form.append("amount_pkr", String(pledge.amount));
  form.append("monthly", pledge.monthly ? "true" : "false");
  await appendFile(form, "receipt", pledge.receipt);
  const response = await authFetch(`/api/animals/${animalId}/sponsor/`, { method: "POST", body: form });
  return parseJson<{ id: number; status: string; amount_pkr: number; monthly: boolean }>(response);
}

// The organization profile (Stitch extra screen): numbers and this month's supply fund.
export type OrganizationProfile = {
  stats: { rescued: number; adopted: number; in_care: number; followers: number; active_cases: number };
  fund: { month: string; goal_pkr: number; raised_pkr: number; percent: number };
  type: string;
  is_available: boolean;
  following: boolean;
  my_pending_donation: boolean;
};

export async function getOrganizationProfile(organizationId: string | number) {
  return parseJson<OrganizationProfile>(await optionalAuthFetch(`/api/organizations/${organizationId}/profile/`));
}

// A gift to the shelter's medical supplies, with the transfer receipt.
export async function donateToShelter(organizationId: number, amount: number, receipt: { uri: string; name: string; type: string }) {
  const form = new FormData();
  form.append("amount_pkr", String(amount));
  await appendFile(form, "receipt", receipt);
  const response = await authFetch(`/api/organizations/${organizationId}/donate/`, { method: "POST", body: form });
  return parseJson<{ id: number; status: string; amount_pkr: number }>(response);
}

// Every organization's public card (search, and rescue numbers kept for offline use).
export type DirectoryOrganization = {
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
};

export async function getOrganizationDirectory(): Promise<DirectoryOrganization[]> {
  const rows = await parseJson<DirectoryOrganization[]>(await fetch(`${API_BASE}/api/organizations/directory/`));
  return rows.map((row) => ({ ...row, image: resolveMediaUrl(row.image) }));
}
