import API, { PublicAPI } from "../api/axios";
import { normalizeCase } from "../utils/media";
import type { Case } from "../types/platform";
import type { AdoptionApplication, AdoptionForm, DirectoryOrganization } from "../types/api";

const toggle = async (url: string, on: boolean) => (on ? API.post(url) : API.delete(url));

// Follows: followers hear about status changes and new posts.
export const followAnimal = (id: number, on: boolean) => toggle(`/api/notifications/follow/animal/${id}/`, on);
export const followOrganization = (id: number, on: boolean) => toggle(`/api/notifications/follow/organization/${id}/`, on);

export const getMyFollows = async () =>
  (await API.get<{ followed_animals: number[]; followed_organizations: number[] }>("/api/notifications/my-follows/")).data;

export const getFollowStatus = async (query: { animal_id?: number; organization_id?: number }) => {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value).map(([key, value]) => [key, String(value)]));
  return (await API.get<{ following_animal?: boolean; following_organization?: boolean }>(`/api/notifications/follow-status/?${params}`)).data;
};

// Adopting, sponsoring and donating.
export const applyToAdopt = async (animalId: number, form: AdoptionForm) =>
  (await API.post<AdoptionApplication>(`/api/animals/${animalId}/apply/`, form)).data;

/** A sponsorship pledge: amount_pkr, monthly and the transfer receipt. */
export const sponsorAnimal = async (animalId: number, data: FormData) => (await API.post(`/api/animals/${animalId}/sponsor/`, data)).data;

/** A gift to the shelter's medical supplies: amount_pkr and the transfer receipt. */
export const donateToOrganization = async (organizationId: number, data: FormData) =>
  (await API.post(`/api/organizations/${organizationId}/donate/`, data)).data;

// Organizations directory.
export const getDirectory = async () => (await PublicAPI.get<DirectoryOrganization[]>("/api/organizations/directory/")).data;

// A reporter's own cases and following a case's updates.
export const getMyReports = async () => (await API.get<Case[]>("/api/cases/my-reports/")).data.map(normalizeCase);

export const setKeepUpdated = (caseId: number, on: boolean) => toggle(`/api/cases/public/${caseId}/keep-updated/`, on);
