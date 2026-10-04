const STATUS_BADGE_CLASS: Record<string, string> = {
  reported: "badge-blue",
  assigned: "badge-amber",
  in_progress: "badge-amber",
  rescued: "badge-green",
  closed: "badge-gray",
  adoption: "badge-purple",
  adoptable: "badge-purple",
  recovering: "badge-amber",
  adopted: "badge-green",
};

export function statusBadgeClass(status: string): string {
  return `badge ${STATUS_BADGE_CLASS[status] ?? "badge-gray"}`;
}
