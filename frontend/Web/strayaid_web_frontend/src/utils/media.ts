import type { Animal, Case, DashboardData, Organization, Post, Report } from "../types/platform";

const API_ORIGIN = "http://127.0.0.1:8000";

export const resolveMediaUrl = (value: string | null | undefined) => {
  if (!value) {
    return value ?? null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(value, API_ORIGIN).toString();
};

const normalizeReport = (report: Report): Report => ({
  ...report,
  image: resolveMediaUrl(report.image) ?? "",
});

export const normalizeOrganization = (organization: Organization): Organization => ({
  ...organization,
  image: resolveMediaUrl(organization.image),
});

export const normalizeAnimal = (animal: Animal): Animal => ({
  ...animal,
  image: resolveMediaUrl(animal.image),
  organization: normalizeOrganization(animal.organization),
});

export const normalizePost = (post: Post): Post => ({
  ...post,
  image: resolveMediaUrl(post.image),
  animal: normalizeAnimal(post.animal),
});

export const normalizeCase = (caseItem: Case): Case => ({
  ...caseItem,
  organization: caseItem.organization ? normalizeOrganization(caseItem.organization) : null,
  reports: caseItem.reports.map(normalizeReport),
});

export const normalizeDashboard = (dashboard: DashboardData): DashboardData => ({
  ...dashboard,
  organization: normalizeOrganization(dashboard.organization),
  recent_cases: dashboard.recent_cases.map(normalizeCase),
  nearby_cases: dashboard.nearby_cases.map(normalizeCase),
});
