import { useSyncExternalStore } from "react";

// The report being written, shared by the steps of the report flow
// (Stitch 7: photo + location, Stitch 8: details). Cleared after submit or discard.

export type LatLng = { latitude: number; longitude: number };
export type ReportPhoto = { uri: string; name: string; type: string };
export type Severity = "low" | "medium" | "high" | "critical";

export type ReportDraft = {
  photo: ReportPhoto | null;
  location: LatLng | null;
  // Short readable place, e.g. "F-7, Islamabad". Sent to the backend as the case's area.
  address: string;
  description: string;
  severity: Severity;
  keepUpdated: boolean;
};

const EMPTY: ReportDraft = {
  photo: null,
  location: null,
  address: "",
  description: "",
  severity: "medium",
  keepUpdated: true,
};

let draft: ReportDraft = EMPTY;
const listeners = new Set<() => void>();

export function updateReportDraft(changes: Partial<ReportDraft>) {
  draft = { ...draft, ...changes };
  listeners.forEach((listener) => listener());
}

export function resetReportDraft() {
  updateReportDraft(EMPTY);
}

export function getReportDraft() {
  return draft;
}

export function useReportDraft() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getReportDraft,
    getReportDraft
  );
}

// Set the animal's location and fill in its readable address once the lookup finishes.
// A newer location wins if the lookups finish out of order.
let locationVersion = 0;
export async function setReportLocation(location: LatLng, describe: (location: LatLng) => Promise<string>) {
  const version = ++locationVersion;
  updateReportDraft({ location, address: "" });
  const address = await describe(location);
  if (version === locationVersion) updateReportDraft({ address });
}

// A typed address that was found: keep the person's own wording as the address.
export function setReportLocationFromSearch(location: LatLng, address: string) {
  locationVersion++;
  updateReportDraft({ location, address });
}
