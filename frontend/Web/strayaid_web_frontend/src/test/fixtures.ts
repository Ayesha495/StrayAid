import type { Case, DashboardData, Organization } from "../types/platform";

export const ORGANIZATION: Organization = {
  id: 9,
  name: "Paws & Care Rescue",
  description: "Volunteer-run rescue.",
  image: null,
  latitude: 33.7215,
  longitude: 73.056,
  address: "Street 12, F-7/2, Islamabad",
  city: "Islamabad",
  capacity: 25,
  radius: 15,
  phone_number: "+92 300 0000101",
  contact_email: "paws-care@strayaid.local",
};

export function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 20,
    reference: "SA-2026-0020",
    title: "Abandoned Cat — F-8",
    description: "Young grey tabby left in a cardboard box.",
    species: "cat",
    area: "F-8",
    latitude: 33.70985,
    longitude: 73.03712,
    status: "reported",
    severity: "medium",
    confidence_score: 32,
    possibly_invalid: false,
    created_at: "2026-10-06T03:35:07Z",
    updated_at: "2026-10-06T04:09:07Z",
    resolved_at: null,
    organization: null,
    distance_km: 2.17,
    reports: [],
    ...overrides,
  };
}

export const DASHBOARD: DashboardData = {
  organization: ORGANIZATION,
  summary: { total_cases: 4, active_cases: 2, rescued_cases: 2, adoption_cases: 1, animals_count: 3, posts_count: 5 },
  recent_cases: [],
  nearby_cases: [],
};
