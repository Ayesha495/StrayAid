import API, { PublicAPI } from "../api/axios";
import type { CaseSearchResult, CaseUpdate, PublicCase, PublicReport } from "../types/api";
import { getStoredUser } from "./authService";

// Signed in, the case says whether you reported or follow it.
const reader = () => (getStoredUser() ? API : PublicAPI);

// The case page as everyone sees it, with the AI score breakdown.
/** Any case, by the address it was reported at, its animal or its reference. */
export const searchCases = async (text: string) =>
  (await PublicAPI.get<CaseSearchResult[]>("/api/cases/search/", { params: { q: text } })).data;

export const getPublicCase = async (caseId: string | number) =>
  (await reader().get<PublicCase>(`/api/cases/public/${caseId}/`)).data;

export const getCaseUpdates = async (caseId: string | number) =>
  (await PublicAPI.get<CaseUpdate[]>(`/api/cases/public/${caseId}/updates/`)).data;

export const getCaseReports = async (caseId: string | number) =>
  (await reader().get<PublicReport[]>(`/api/cases/public/${caseId}/reports/`)).data;

/** An organization's note on its case; reporters and followers are notified. */
export const addCaseNote = async (caseId: string | number, message: string) =>
  (await API.post<CaseUpdate>(`/api/cases/${caseId}/add-update/`, { message })).data;

/** Community numbers for the landing page. */
export const getCommunityStats = async () =>
  (await PublicAPI.get<{ rescued_total: number; rescued_today: number; demo_data?: boolean }>("/api/cases/stats/")).data;
