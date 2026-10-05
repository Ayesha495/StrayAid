import { authFetch } from "./apiClient";
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
  bank_account_title?: string;
  bank_account_number?: string;
  user_email?: string;
  is_verified?: boolean;
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
  description: string;
  latitude: number;
  longitude: number;
  created_at: string;
  user_email?: string;
};
export type MobileCase = {
  id: number;
  reference?: string;
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
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

export async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(data, response.status));
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
  const response = await fetch(`${API_BASE}/api/animals/public/`);
  return (await parseJson<MobileAnimal[]>(response)).map(normalizeAnimal);
}

export async function getMyReports() {
  const response = await authFetch(`/api/cases/my-reports/`);
  return parseJson<MobileCase[]>(response);
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
  const response = await fetch(`${API_BASE}/api/animals/${animalId}/`);
  return normalizeAnimal(await parseJson<MobileAnimal>(response));
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
export type PhotoCheckResult = { ok: true; animal: string; confidence: number } | { ok: false; reason: "not_an_animal" };

export async function checkReportPhoto(photo: { uri: string; name: string; type: string }): Promise<PhotoCheckResult> {
  const form = new FormData();
  await appendFile(form, "image", photo);
  const response = await authFetch("/api/cases/check-photo/", { method: "POST", body: form });
  if (response.status === 422) return { ok: false, reason: "not_an_animal" };
  const data = await parseJson<{ animal: string; confidence: number }>(response);
  return { ok: true, animal: data.animal, confidence: data.confidence };
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
