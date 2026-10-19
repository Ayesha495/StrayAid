import type { Case, CaseStatus } from "../types/platform";
import { capitalize } from "./format";

/** Cases waiting for any rescue team. */
export const isUnclaimed = (item: Case) => !item.organization && item.status === "reported";

/** Cases a team is working on right now ("in transit" on the map). */
export const isActive = (item: Case) => item.status === "assigned" || item.status === "in_progress";

export const caseTitle = (item: Pick<Case, "title" | "species" | "area" | "id">) =>
  item.title || `${capitalize(item.species) || "Animal"} case${item.area ? ` · ${item.area}` : ""}`;

export const caseReference = (item: Pick<Case, "reference" | "id">) => item.reference || `#${item.id}`;

export const casePhoto = (item: Case) => item.reports?.find((report) => report.image)?.image ?? null;

/**
 * The only status changes an organization may make, in order. The backend accepts any
 * status, so the web enforces the rescue flow here:
 * reported → assigned → in_progress → rescued → adoption or closed.
 */
export const NEXT_STATUSES: Record<CaseStatus, CaseStatus[]> = {
  reported: ["assigned"],
  assigned: ["in_progress", "closed"],
  in_progress: ["rescued", "closed"],
  rescued: ["adoption", "closed"],
  adoption: ["closed"],
  closed: [],
};

export const nextStatuses = (status: string) => NEXT_STATUSES[status as CaseStatus] ?? [];

export const NEXT_STATUS_ACTION: Record<string, string> = {
  assigned: "Assign responder",
  in_progress: "Start rescue",
  rescued: "Mark rescued",
  adoption: "Open for adoption",
  closed: "Close case",
};

/** Higher score first; unscored cases last, then newest first. */
export const byScore = (a: Case, b: Case) =>
  (b.confidence_score ?? -1) - (a.confidence_score ?? -1) || Date.parse(b.created_at) - Date.parse(a.created_at);
