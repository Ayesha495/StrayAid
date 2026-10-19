import API, { PublicAPI } from "../api/axios";
import type { AdoptionApplication, OrganizationProfileStats, ShelterDonation, Sponsorship } from "../types/api";

// Adoption applications: an organization gets the ones for its animals, anyone else their own.
export const getApplications = async (status?: string) =>
  (await API.get<AdoptionApplication[]>(`/api/animals/applications/${status ? `?status=${status}` : ""}`)).data;

export const decideApplication = async (id: number, status: "approved" | "rejected") =>
  (await API.post<AdoptionApplication>(`/api/animals/applications/${id}/decide/`, { status })).data;

export const withdrawApplication = async (id: number) =>
  (await API.post<AdoptionApplication>(`/api/animals/applications/${id}/withdraw/`)).data;

// Sponsorship pledges and shelter donations, each with a transfer receipt to check.
export const getSponsorships = async () => (await API.get<Sponsorship[]>("/api/animals/sponsorships/")).data;

export const reviewSponsorship = async (id: number, status: "confirmed" | "rejected") =>
  (await API.post<Sponsorship>(`/api/animals/sponsorships/${id}/review/`, { status })).data;

export const getDonations = async () => (await API.get<ShelterDonation[]>("/api/organizations/donations/")).data;

export const reviewDonation = async (id: number, status: "confirmed" | "rejected") =>
  (await API.post<{ id: number; status: string }>(`/api/organizations/donations/${id}/review/`, { status })).data;

/** Public numbers for an organization, including this month's supply fund. */
export const getOrganizationStats = async (organizationId: number | string) =>
  (await PublicAPI.get<OrganizationProfileStats>(`/api/organizations/${organizationId}/profile/`)).data;
