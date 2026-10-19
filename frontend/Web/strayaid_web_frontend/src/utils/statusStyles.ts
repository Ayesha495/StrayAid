// How every status looks. The same meanings as the dashboard, everywhere:
// coral = needs attention, amber = in progress or waiting, green = done or good, purple = adoption.

type ChipStyle = { label: string; className: string };

const CASE_STATUS: Record<string, ChipStyle> = {
  reported: { label: "Reported", className: "chip-coral chip-dot" },
  assigned: { label: "Assigned", className: "chip-amber chip-dot" },
  in_progress: { label: "In progress", className: "chip-amber chip-dot" },
  rescued: { label: "Rescued", className: "chip-green chip-dot" },
  adoption: { label: "Up for adoption", className: "chip-purple chip-dot" },
  closed: { label: "Closed", className: "chip-outline" },
};

const SEVERITY: Record<string, ChipStyle> = {
  critical: { label: "Critical", className: "chip-solid-coral" },
  high: { label: "High", className: "chip-coral" },
  medium: { label: "Medium", className: "chip-navy" },
  low: { label: "Low", className: "chip-outline" },
};

const ANIMAL_STATUS: Record<string, ChipStyle> = {
  rescued: { label: "Rescued", className: "chip-navy" },
  recovering: { label: "Recovering", className: "chip-amber" },
  adoptable: { label: "Adoptable", className: "chip-purple" },
  adopted: { label: "Adopted", className: "chip-solid-green" },
};

const REVIEW_STATUS: Record<string, ChipStyle> = {
  pending: { label: "Pending", className: "chip-amber chip-dot" },
  approved: { label: "Approved", className: "chip-green chip-dot" },
  confirmed: { label: "Confirmed", className: "chip-green chip-dot" },
  rejected: { label: "Declined", className: "chip-coral chip-dot" },
  withdrawn: { label: "Withdrawn", className: "chip-outline" },
};

export const CHIP_KINDS = {
  case: CASE_STATUS,
  severity: SEVERITY,
  animal: ANIMAL_STATUS,
  review: REVIEW_STATUS,
};

export type ChipKind = keyof typeof CHIP_KINDS;

export function chipStyle(kind: ChipKind, value: string): ChipStyle {
  return CHIP_KINDS[kind][value] ?? { label: value.replace(/_/g, " "), className: "chip-outline" };
}

export const statusLabel = (kind: ChipKind, value: string) => chipStyle(kind, value).label;
