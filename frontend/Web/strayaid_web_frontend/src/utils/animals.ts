import type { Animal } from "../types/platform";
import { formatDate } from "./format";

// The animal lifecycle as the team sees it. The backend enforces these moves
// (Animal.NEXT_STATUSES); this file words them and decides which buttons to show.

export const LEFT_CARE = ["adopted", "released", "deceased"];

export const isInCare = (animal: Pick<Animal, "status">) => !LEFT_CARE.includes(animal.status);

export const HEALTH: Record<string, { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "emerald" },
  minor_issues: { label: "Minor issues", tone: "amber" },
  under_treatment: { label: "Under treatment", tone: "blue" },
  special_needs: { label: "Special needs", tone: "coral" },
};

export const MEDICAL_KINDS = [
  { value: "checkup", label: "Check-up", chip: "chip-green" },
  { value: "vaccination", label: "Vaccination", chip: "chip-blue" },
  { value: "deworming", label: "Deworming", chip: "chip-amber" },
  { value: "sterilization", label: "Spay or neuter", chip: "chip-purple" },
  { value: "treatment", label: "Treatment", chip: "chip-coral" },
  { value: "surgery", label: "Surgery", chip: "chip-coral" },
  { value: "other", label: "Other", chip: "chip-slate" },
];

export const medicalKind = (value: string) => MEDICAL_KINDS.find((kind) => kind.value === value) ?? MEDICAL_KINDS[MEDICAL_KINDS.length - 1];

/** Age as people say it; 0 is how the form stores "younger than a year". */
export const ageLabel = (age: number | null | undefined) => {
  if (age === null || age === undefined) return "";
  return age < 1 ? "Under 1 year" : `${age} ${age === 1 ? "year" : "years"}`;
};

/** Today as the YYYY-MM-DD a date input uses, in the person's own timezone. */
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** A calendar date from the API, read as local midnight so it never slips to the day before. */
export const formatDay = (day: string | null | undefined) => (day ? formatDate(`${day}T00:00:00`) : "");

const daysUntil = (day: string) => Math.round((Date.parse(`${day}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) / 86_400_000);

/** How a follow-up reads and how loudly: overdue is coral, the coming week amber. */
export function dueChip(day: string) {
  const days = daysUntil(day);
  if (days < 0) return { label: `Overdue by ${-days} ${days === -1 ? "day" : "days"}`, className: "chip-coral chip-dot" };
  if (days === 0) return { label: "Due today", className: "chip-amber chip-dot" };
  if (days <= 7) return { label: `Due in ${days} ${days === 1 ? "day" : "days"}`, className: "chip-amber chip-dot" };
  return { label: `Due ${formatDay(day)}`, className: "chip-slate" };
}

export const LIFECYCLE_STEPS = [
  { key: "rescued", label: "Rescued" },
  { key: "recovering", label: "Recovering" },
  { key: "adoptable", label: "Up for adoption" },
];

const FINAL_STEP: Record<string, string> = { adopted: "Adopted", released: "Back home", deceased: "Passed away" };

export const finalStepLabel = (status: string) => FINAL_STEP[status] ?? "Adopted";

export type StatusMove = {
  to: string;
  label: string;
  /** What the dialog says will happen, so nobody finds out afterwards. */
  explain: string;
  noteLabel: string;
  notePlaceholder: string;
  noteRequired: boolean;
};

const TO_TREATMENT: StatusMove = {
  to: "recovering",
  label: "Start treatment",
  explain: "Followers and the reporter hear that this animal is recovering.",
  noteLabel: "Note (optional)",
  notePlaceholder: "e.g. Leg wound cleaned, on antibiotics for 7 days.",
  noteRequired: false,
};

const TO_ADOPTION: StatusMove = {
  to: "adoptable",
  label: "Open for adoption",
  explain: "The animal appears as adoptable, people can apply, and the rescue case moves to adoption.",
  noteLabel: "Note (optional)",
  notePlaceholder: "e.g. Vet cleared her on 12 October.",
  noteRequired: false,
};

const OUTCOMES: StatusMove[] = [
  {
    to: "released",
    label: "Released or returned",
    explain: "The record closes, the rescue case closes, and the animal leaves your public lists. Any pending applications are declined.",
    noteLabel: "What happened?",
    notePlaceholder: "e.g. Returned to her owner, or released in G-11 after treatment.",
    noteRequired: true,
  },
  {
    to: "deceased",
    label: "Passed away",
    explain: "The record closes, the rescue case closes, and the animal leaves your public lists. Followers are told gently and pending applications are declined.",
    noteLabel: "What happened?",
    notePlaceholder: "e.g. Kidney failure despite treatment.",
    noteRequired: true,
  },
];

const MOVES: Record<string, StatusMove[]> = {
  rescued: [TO_TREATMENT, TO_ADOPTION],
  recovering: [TO_ADOPTION],
  adoptable: [
    {
      to: "adopted",
      label: "Adopted outside StrayAid",
      explain: "Use this when the family didn't apply here. The rescue case closes and any pending applications are declined.",
      noteLabel: "Who adopted, and how to reach them?",
      notePlaceholder: "e.g. Hira Khan, 0300 1234567. Met at our open day.",
      noteRequired: true,
    },
    {
      ...TO_TREATMENT,
      label: "Back to treatment",
      explain: "The animal stops being adoptable. Pending applications stay on hold until you open adoption again.",
    },
  ],
  adopted: [
    {
      ...TO_TREATMENT,
      label: "Record a return",
      explain: "The adoption ends, the adopter is told, and the rescue case reopens with the animal back in your care.",
      noteLabel: "Why did the animal come back?",
      notePlaceholder: "e.g. The family moved abroad.",
      noteRequired: true,
    },
    {
      ...TO_ADOPTION,
      label: "Returned, ready to rehome",
      explain: "The adoption ends, the adopter is told, and the animal goes straight back up for adoption.",
      noteLabel: "Why did the animal come back?",
      notePlaceholder: "e.g. The family moved abroad.",
      noteRequired: true,
    },
  ],
  released: [
    {
      ...TO_TREATMENT,
      label: "Back in care",
      explain: "The record and the rescue case reopen.",
      noteLabel: "What happened?",
      notePlaceholder: "e.g. Found injured again near the same spot.",
      noteRequired: true,
    },
  ],
  deceased: [
    {
      ...TO_TREATMENT,
      label: "Correct this record",
      explain: "Use this only if the record was closed by mistake. The record and the rescue case reopen.",
      noteLabel: "What was wrong?",
      notePlaceholder: "e.g. Recorded on the wrong animal.",
      noteRequired: true,
    },
  ],
};

export const statusMoves = (status: string) => MOVES[status] ?? [];

/** The ways out of care, offered quietly under the main actions while an animal is with the team. */
export const outcomeMoves = (status: string) => (LEFT_CARE.includes(status) ? [] : OUTCOMES);

export const NEXT_STEP_HINT: Record<string, string> = {
  rescued: "Newly in your care. Record a first check-up, then start treatment or open adoption.",
  recovering: "Keep the medical history up to date. Open adoption once treatment is finished.",
  adoptable: "Listed for adoption. Review applications as they arrive; approving one completes the adoption.",
  adopted: "This animal has found a home. If it comes back, record the return here.",
  released: "This animal has gone back home. The record stays here for your history.",
  deceased: "This animal has passed away. The record stays here for your history.",
};
