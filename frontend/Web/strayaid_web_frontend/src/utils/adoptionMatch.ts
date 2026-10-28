import type { AdoptionApplication } from "../types/api";

/**
 * A guide for comparing adoption applicants, the way shelters usually do it: first the
 * requirements every adopter must meet (pass/fail), then a match score out of 100 from a
 * few weighted criteria with partial credit. It suggests a "top match"; the organization
 * still makes the decision.
 *
 * Children and other pets aren't scored: whether they're a plus depends on the animal.
 */

export type Requirement = { key: string; label: string; met: boolean; detail: string };

export type CriterionResult = {
  key: string;
  label: string;
  hint: string;
  weight: number;
  /** 0-1 share of the weight earned. */
  value: number;
  points: number;
  answer: string;
};

export type ApplicantMatch = {
  application: AdoptionApplication;
  score: number;
  criteria: CriterionResult[];
  requirements: Requirement[];
  meetsRequirements: boolean;
};

const HOURS_ALONE = (hours: number | null) => {
  if (hours === null) return { value: 0.4, answer: "Not said" };
  const answer = `${hours} h alone a day`;
  if (hours <= 4) return { value: 1, answer };
  if (hours <= 6) return { value: 0.8, answer };
  if (hours <= 8) return { value: 0.55, answer };
  return { value: 0.25, answer };
};

const EXPERIENCE = {
  experienced: { value: 1, answer: "Very experienced" },
  some: { value: 0.75, answer: "Had pets before" },
  first_time: { value: 0.5, answer: "First pet" },
  "": { value: 0.3, answer: "Not said" },
} as const;

const HOME_TYPE = { house: 1, apartment: 0.7, other: 0.6 } as const;
const HOME_LABEL = { house: "House", apartment: "Apartment", other: "Other home" } as const;

function homeFit(a: AdoptionApplication) {
  const space = HOME_TYPE[a.home_type] ?? 0.6;
  let stability: number;
  let tenure: string;
  if (a.ownership === "own") {
    stability = 1;
    tenure = "owns";
  } else if (a.ownership === "rent") {
    stability = a.landlord_allows_pets ? 0.85 : 0.4;
    tenure = a.landlord_allows_pets ? "rents, pets allowed" : "rents, pets not confirmed";
  } else {
    stability = 0.6;
    tenure = "ownership not said";
  }
  return { value: (space + stability) / 2, answer: `${HOME_LABEL[a.home_type] ?? "Home"}, ${tenure}` };
}

// Considered answers to "why adopt" and "care plan": full marks from ~150 characters each.
function thoughtfulness(a: AdoptionApplication) {
  const part = (text: string) => Math.min((text || "").trim().length / 150, 1);
  const value = (part(a.reason) + part(a.care_plan)) / 2;
  const answer = value >= 0.8 ? "Detailed answers" : value >= 0.4 ? "Brief answers" : "Very short answers";
  return { value, answer };
}

export const CRITERIA: Array<{
  key: string;
  label: string;
  hint: string;
  weight: number;
  read: (a: AdoptionApplication) => { value: number; answer: string };
}> = [
  {
    key: "time",
    label: "Time together",
    hint: "Fewer hours alone each day scores higher.",
    weight: 30,
    read: (a) => HOURS_ALONE(a.hours_alone),
  },
  {
    key: "experience",
    label: "Experience",
    hint: "Experienced owners score higher; first-time adopters may just need more guidance.",
    weight: 25,
    read: (a) => EXPERIENCE[a.experience] ?? EXPERIENCE[""],
  },
  {
    key: "home",
    label: "Home fit",
    hint: "Space (house over apartment) and stability (owning, or renting with pets allowed).",
    weight: 25,
    read: homeFit,
  },
  {
    key: "answers",
    label: "Thoughtful answers",
    hint: "How fully they explained why they want to adopt and how they'll care for the animal.",
    weight: 20,
    read: thoughtfulness,
  },
];

function requirements(a: AdoptionApplication): Requirement[] {
  const list: Requirement[] = [
    {
      key: "home_visit",
      label: "Agrees to a home visit",
      met: a.agrees_home_visit,
      detail: a.agrees_home_visit ? "Agreed" : "Didn't agree",
    },
    {
      key: "return_policy",
      label: "Agrees to the return policy",
      met: a.agrees_return_policy,
      detail: a.agrees_return_policy ? "Agreed" : "Didn't agree",
    },
  ];
  if (a.ownership === "rent") {
    list.push({
      key: "landlord",
      label: "Landlord allows pets",
      met: a.landlord_allows_pets === true,
      detail: a.landlord_allows_pets === true ? "Yes" : a.landlord_allows_pets === false ? "No" : "Not confirmed",
    });
  }
  return list;
}

export function evaluate(application: AdoptionApplication): ApplicantMatch {
  const criteria = CRITERIA.map((criterion) => {
    const { value, answer } = criterion.read(application);
    return {
      key: criterion.key,
      label: criterion.label,
      hint: criterion.hint,
      weight: criterion.weight,
      value,
      points: Math.round(value * criterion.weight),
      answer,
    };
  });
  const reqs = requirements(application);
  return {
    application,
    score: criteria.reduce((sum, item) => sum + item.points, 0),
    criteria,
    requirements: reqs,
    meetsRequirements: reqs.every((item) => item.met),
  };
}

export type GroupRanking = {
  /** Applicants, best match first: still-open applications that meet the requirements lead. */
  ranked: ApplicantMatch[];
  /** The suggested applicant: the highest-scoring pending one that meets every requirement. */
  topMatchId: number | null;
  /** Someone was already approved, so the animal is adopted. */
  approvedId: number | null;
  /** For each criterion, the applicant ids sharing the best value (empty when all tie). */
  bestByCriterion: Record<string, number[]>;
};

const OPEN_FIRST = { pending: 0, approved: 0, rejected: 1, withdrawn: 2 } as const;

export function rankApplicants(applications: AdoptionApplication[]): GroupRanking {
  const ranked = applications
    .map(evaluate)
    .sort(
      (a, b) =>
        OPEN_FIRST[a.application.status] - OPEN_FIRST[b.application.status] ||
        Number(b.meetsRequirements) - Number(a.meetsRequirements) ||
        b.score - a.score ||
        a.application.created_at.localeCompare(b.application.created_at),
    );
  const approved = applications.find((item) => item.status === "approved") ?? null;
  const top = approved
    ? null
    : ranked.find((match) => match.application.status === "pending" && match.meetsRequirements) ?? null;

  const bestByCriterion: Record<string, number[]> = {};
  const compared = ranked.filter((match) => match.application.status === "pending" || match.application.status === "approved");
  CRITERIA.forEach((criterion, index) => {
    const values = compared.map((match) => match.criteria[index].value);
    const best = Math.max(...values);
    const winners = compared.filter((match) => match.criteria[index].value === best);
    bestByCriterion[criterion.key] =
      compared.length > 1 && winners.length < compared.length ? winners.map((match) => match.application.id) : [];
  });

  return { ranked, topMatchId: top?.application.id ?? null, approvedId: approved?.id ?? null, bestByCriterion };
}

/** Words for a score, so the number never has to stand alone. */
export function scoreLabel(score: number) {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Fair match";
  return "Weak match";
}
