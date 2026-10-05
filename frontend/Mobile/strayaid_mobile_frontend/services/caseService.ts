import AsyncStorage from "@react-native-async-storage/async-storage";

import { authFetch, optionalAuthFetch } from "./apiClient";
import { parseJson, resolveMediaUrl } from "./mobileContentService";
import type { Severity } from "./reportDraft";

// Public rescue case page (Stitch 10) with its updates and reports. Guests can read; the
// signed-in viewer also gets keep_updated / is_reporter.

export type CaseStatus = "reported" | "assigned" | "in_progress" | "rescued" | "adoption" | "closed";

export type CaseDetail = {
  id: number;
  reference: string;
  title: string;
  species: string;
  area: string;
  severity: Severity;
  confidence_score: number | null;
  possibly_invalid: boolean;
  status: CaseStatus;
  status_label: string;
  image: string | null; // the photo of the report that started the case
  report_count: number;
  created_at: string;
  description: string;
  organization: {
    id: number;
    name: string;
    type: string;
    city: string;
    phone: string;
    email: string;
    image: string | null;
  } | null;
  animal: { id: number; name: string } | null;
  update_count: number;
  latest_update_at: string | null;
  keep_updated: boolean;
  is_reporter: boolean;
  ai: CaseAI;
};

export type AIFeedbackReason = "no_animal" | "wrong_animal" | "wrong_score";

// How the AI confidence score was made (Stitch 11), see backend rescue/utils/scoring.py:
// score = (50% photo + 30% severity + 20% reports) x freshness.
export type CaseAI = {
  model: string;
  scored: boolean;
  animal_confidence: number | null; // 0-1, the best single photo
  animal: string; // "dog", "cat", ...
  box: [number, number, number, number] | null; // x0, y0, x1, y1 in 0-1 image units
  image: string | null; // that best photo
  photo_confidence: number | null; // 0-1, all photos combined
  photo_count: number;
  severity_weight: number; // 0-1
  report_count: number;
  report_weight: number; // 0-1
  hours_unanswered: number; // since the latest report, until an organization responded
  answered: boolean;
  freshness: number; // 0.5-1
  my_feedback: AIFeedbackReason | null;
};

export type CaseUpdate = {
  id: number;
  status: CaseStatus | "";
  status_label: string;
  message: string;
  author_name: string | null;
  created_at: string;
};

export type CaseReport = {
  id: number;
  image: string | null;
  description: string;
  severity: Severity;
  created_at: string;
  reporter: string;
  is_mine: boolean;
};

export async function getCase(caseId: string | number): Promise<CaseDetail> {
  const data = await parseJson<CaseDetail>(await optionalAuthFetch(`/api/cases/public/${caseId}/`));
  return {
    ...data,
    image: resolveMediaUrl(data.image),
    organization: data.organization && { ...data.organization, image: resolveMediaUrl(data.organization.image) },
    ai: { ...data.ai, image: resolveMediaUrl(data.ai.image) },
  };
}

// "Report incorrect AI detection".
export async function sendAIFeedback(caseId: number, reason: AIFeedbackReason) {
  const response = await authFetch(`/api/cases/public/${caseId}/ai-feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return parseJson<{ reason: AIFeedbackReason }>(response);
}

export async function getCaseUpdates(caseId: string | number): Promise<CaseUpdate[]> {
  return parseJson<CaseUpdate[]>(await optionalAuthFetch(`/api/cases/public/${caseId}/updates/`));
}

export async function getCaseReports(caseId: string | number): Promise<CaseReport[]> {
  const reports = await parseJson<CaseReport[]>(await optionalAuthFetch(`/api/cases/public/${caseId}/reports/`));
  return reports.map((report) => ({ ...report, image: resolveMediaUrl(report.image) }));
}

export async function setCaseKeepUpdated(caseId: number, keepUpdated: boolean) {
  const response = await authFetch(`/api/cases/public/${caseId}/keep-updated/`, {
    method: keepUpdated ? "POST" : "DELETE",
  });
  return parseJson<{ keep_updated: boolean }>(response);
}

// "3 new" on the Case Updates row: updates newer than the last time this phone opened them.
const seenKey = (caseId: number) => `case-updates-seen:${caseId}`;

export async function getUpdatesSeenAt(caseId: number): Promise<number> {
  return Number((await AsyncStorage.getItem(seenKey(caseId)).catch(() => null)) ?? 0);
}

export async function markUpdatesSeen(caseId: number) {
  await AsyncStorage.setItem(seenKey(caseId), String(Date.now())).catch(() => null);
}
