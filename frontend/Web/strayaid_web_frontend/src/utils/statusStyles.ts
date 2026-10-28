// How every status looks, matching the mobile app's chips (soft tinted pills):
// amber = waiting, green = a team is on it or it's done, coral/red = severity, slate = closed.

type ChipStyle = { label: string; className: string };

const CASE_STATUS: Record<string, ChipStyle> = {
  reported: { label: "Reported", className: "chip-amber chip-dot" },
  assigned: { label: "Assigned", className: "chip-green chip-dot" },
  in_progress: { label: "In progress", className: "chip-green chip-dot" },
  rescued: { label: "Rescued", className: "chip-green chip-dot" },
  adoption: { label: "Up for adoption", className: "chip-green chip-dot" },
  closed: { label: "Closed", className: "chip-slate" },
};

const SEVERITY: Record<string, ChipStyle> = {
  critical: { label: "Critical", className: "chip-critical chip-dot" },
  high: { label: "High", className: "chip-coral chip-dot" },
  medium: { label: "Medium", className: "chip-amber chip-dot" },
  low: { label: "Low", className: "chip-emerald chip-dot" },
};

const ANIMAL_STATUS: Record<string, ChipStyle> = {
  rescued: { label: "Rescued", className: "chip-green" },
  recovering: { label: "Recovering", className: "chip-green" },
  adoptable: { label: "Adoptable", className: "chip-green chip-dot" },
  adopted: { label: "Adopted", className: "chip-slate" },
};

const REVIEW_STATUS: Record<string, ChipStyle> = {
  pending: { label: "Pending", className: "chip-amber chip-dot" },
  approved: { label: "Approved", className: "chip-emerald chip-dot" },
  confirmed: { label: "Confirmed", className: "chip-emerald chip-dot" },
  rejected: { label: "Declined", className: "chip-coral chip-dot" },
  withdrawn: { label: "Withdrawn", className: "chip-slate" },
};

// Transfer receipts. A payment may already have been made, so it's never "rejected": the
// organization either finds it in its account or can't find it yet.
const PAYMENT_STATUS: Record<string, ChipStyle> = {
  pending: { label: "Awaiting verification", className: "chip-amber chip-dot" },
  confirmed: { label: "Payment verified", className: "chip-emerald chip-dot" },
  rejected: { label: "Payment not found", className: "chip-coral chip-dot" },
};

export const CHIP_KINDS = {
  case: CASE_STATUS,
  severity: SEVERITY,
  animal: ANIMAL_STATUS,
  review: REVIEW_STATUS,
  payment: PAYMENT_STATUS,
};

export type ChipKind = keyof typeof CHIP_KINDS;

export function chipStyle(kind: ChipKind, value: string): ChipStyle {
  return CHIP_KINDS[kind][value] ?? { label: value.replace(/_/g, " "), className: "chip-slate" };
}

export const statusLabel = (kind: ChipKind, value: string) => chipStyle(kind, value).label;
