import { evaluate, rankApplicants, scoreLabel } from "../adoptionMatch";
import type { AdoptionApplication } from "../../types/api";

const LUNA = { id: 15, name: "Luna", species: "Cat", status: "adoptable", image: null };
const LONG = "x".repeat(150);

const application = (id: number, extra: Partial<AdoptionApplication> = {}): AdoptionApplication => ({
  id, animal: LUNA, animal_name: "Luna", status: "pending", created_at: `2026-10-0${id}T00:00:00Z`, decided_at: null,
  full_name: `Applicant ${id}`, phone: "", home_type: "house", has_other_pets: false, city: "Islamabad", ownership: "own",
  landlord_allows_pets: null, household_size: 2, has_children: false, hours_alone: 2, experience: "experienced",
  reason: LONG, care_plan: LONG, agrees_home_visit: true, agrees_return_policy: true, ...extra,
});

describe("adoption match score", () => {
  it("gives full marks to an ideal applicant", () => {
    const match = evaluate(application(1));
    expect(match.score).toBe(100);
    expect(match.meetsRequirements).toBe(true);
    expect(scoreLabel(match.score)).toBe("Strong match");
  });

  it("gives partial credit instead of all or nothing", () => {
    const match = evaluate(application(1, { hours_alone: 7, experience: "first_time", home_type: "apartment" }));
    const points = Object.fromEntries(match.criteria.map((item) => [item.key, item.points]));
    // 30 * 0.55, 25 * 0.5, 25 * (0.7 + 1) / 2, 20
    expect(points).toEqual({ time: 17, experience: 13, home: 21, answers: 20 });
    expect(match.score).toBe(71);
  });

  it("only asks renters for landlord permission", () => {
    expect(evaluate(application(1)).requirements.map((item) => item.key)).toEqual(["home_visit", "return_policy"]);
    const renter = evaluate(application(2, { ownership: "rent", landlord_allows_pets: null }));
    expect(renter.meetsRequirements).toBe(false);
    expect(renter.requirements.find((item) => item.key === "landlord")?.detail).toBe("Not confirmed");
  });
});

describe("ranking applicants", () => {
  it("suggests the best pending applicant who meets every requirement", () => {
    const ranking = rankApplicants([
      application(1, { hours_alone: 10 }),
      application(2, { agrees_return_policy: false }), // higher score, but missing a requirement
      application(3, { hours_alone: 5 }),
    ]);
    expect(ranking.topMatchId).toBe(3);
    expect(ranking.ranked.map((match) => match.application.id)).toEqual([3, 1, 2]);
    expect(ranking.bestByCriterion.time).toEqual([2]);
  });

  it("suggests nobody once someone is approved, or when nobody qualifies", () => {
    expect(rankApplicants([application(1), application(2, { status: "approved" })])).toMatchObject({ topMatchId: null, approvedId: 2 });
    expect(rankApplicants([application(1, { agrees_home_visit: false })]).topMatchId).toBeNull();
  });

  it("marks no 'best' when everyone ties on a criterion", () => {
    expect(rankApplicants([application(1), application(2)]).bestByCriterion.experience).toEqual([]);
  });
});
