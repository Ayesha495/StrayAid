import { getToken } from "../utils/tokenStorage";
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
  donation_info: string;
  status: string;
  image: string | null;
  organization: MobileOrganization;
  created_at: string;
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

async function parseJson<T>(response: Response): Promise<T> {
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
  const token = await getToken();
  const response = await fetch(`${API_BASE}/api/cases/my-reports/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<MobileCase[]>(response);
}

export async function getCurrentUser() {
  const token = await getToken();
  const response = await fetch(`${API_BASE}/auth/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<MobileUser>(response);
}

export async function getMyOrganizationProfile() {
  const token = await getToken();
  const response = await fetch(`${API_BASE}/api/organizations/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  const token = await getToken();
  const response = await fetch(`${API_BASE}/api/notifications/my-follows/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function submitReport(formData: FormData) {
  const token = await getToken();
  const response = await fetch(`${API_BASE}/api/cases/report/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseJson<{ message: string; case_id: number; report_id: number }>(response);
}
