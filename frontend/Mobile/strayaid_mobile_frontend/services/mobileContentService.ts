import { getToken } from "../utils/tokenStorage";

const API_BASE = process.env.IP || "http://192.168.1.16:8000";

export type MobileOrganization = { id: number; name: string };
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
  breed: string;
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

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }
  return data as T;
}

export async function getPublicFeed() {
  const response = await fetch(`${API_BASE}/api/posts/public-feed/`);
  return parseJson<MobilePost[]>(response);
}

export async function getPublicAnimals() {
  const response = await fetch(`${API_BASE}/api/animals/public/`);
  return parseJson<MobileAnimal[]>(response);
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

export async function getAnimal(animalId: string | number) {
  const response = await fetch(`${API_BASE}/api/animals/${animalId}/`);
  return parseJson<MobileAnimal>(response);
}

export async function getAnimalPosts(animalId: string | number) {
  const response = await fetch(`${API_BASE}/api/posts/by-animal/?animal_id=${animalId}`);
  return parseJson<MobilePost[]>(response);
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
