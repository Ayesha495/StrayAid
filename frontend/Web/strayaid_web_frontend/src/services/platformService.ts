import API, { PublicAPI } from "../api/axios";
import type { Animal, Case, DashboardData, Organization, Post } from "../types/platform";

export const getOrganizationProfile = async () => {
  const response = await API.get<Organization>("/api/organizations/me/");
  return response.data;
};

export const createOrganizationProfile = async (data: Partial<Organization>) => {
  const response = await API.post<Organization>("/api/organizations/", data);
  return response.data;
};

export const updateOrganizationProfile = async (data: Partial<Organization>) => {
  const response = await API.patch<Organization>("/api/organizations/me/", data);
  return response.data;
};

export const getDashboard = async () => {
  const response = await API.get<DashboardData>("/api/organizations/dashboard/");
  return response.data;
};

export const getNearbyCases = async () => {
  const response = await API.get<Case[]>("/api/cases/nearby/");
  return response.data;
};

export const getCases = async () => {
  const response = await API.get<Case[]>("/api/cases/");
  return response.data;
};

export const getMyCases = async () => {
  const response = await API.get<Case[]>("/api/cases/my-cases/");
  return response.data;
};

export const getCase = async (caseId: string) => {
  const response = await API.get<Case>(`/api/cases/${caseId}/`);
  return response.data;
};

export const acceptCase = async (caseId: string | number) => {
  const response = await API.post<Case>(`/api/cases/${caseId}/accept/`);
  return response.data;
};

export const updateCaseStatus = async (caseId: string | number, status: string) => {
  const response = await API.patch<Case>(`/api/cases/${caseId}/update-status/`, { status });
  return response.data;
};

export const createAnimal = async (data: FormData) => {
  const response = await API.post<Animal>("/api/animals/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateAnimal = async (animalId: number, data: FormData | Partial<Animal>) => {
  const response = await API.patch<Animal>(`/api/animals/${animalId}/`, data, {
    headers: data instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
  });
  return response.data;
};

export const getOrganizationAnimals = async () => {
  const response = await API.get<Animal[]>("/api/animals/organization/");
  return response.data;
};

export const getPublicAnimals = async () => {
  const response = await PublicAPI.get<Animal[]>("/api/animals/public/");
  return response.data;
};

export const getAnimal = async (animalId: string) => {
  const response = await PublicAPI.get<Animal>(`/api/animals/${animalId}/`);
  return response.data;
};

export const createPost = async (data: FormData) => {
  const response = await API.post<Post>("/api/posts/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getAnimalPosts = async (animalId: string) => {
  const response = await PublicAPI.get<Post[]>(`/api/posts/by-animal/?animal_id=${animalId}`);
  return response.data;
};

export const getPublicFeed = async () => {
  const response = await PublicAPI.get<Post[]>("/api/posts/public-feed/");
  return response.data;
};
