import { byScore, caseTitle, isActive, isUnclaimed, nextStatuses } from "../cases";
import { notificationLink } from "../notifications";
import { makeCase, ORGANIZATION } from "../../test/fixtures";
import type { AppNotification } from "../../types/api";

describe("case status flow", () => {
  it("only offers the next steps of the rescue", () => {
    expect(nextStatuses("reported")).toEqual(["assigned"]);
    expect(nextStatuses("assigned")).toEqual(["in_progress", "closed"]);
    expect(nextStatuses("in_progress")).toEqual(["rescued", "closed"]);
    expect(nextStatuses("rescued")).toEqual(["adoption", "closed"]);
    expect(nextStatuses("adoption")).toEqual(["closed"]);
    expect(nextStatuses("closed")).toEqual([]);
    expect(nextStatuses("something-else")).toEqual([]);
  });

  it("tells unclaimed cases from ones being rescued", () => {
    expect(isUnclaimed(makeCase())).toBe(true);
    expect(isUnclaimed(makeCase({ organization: ORGANIZATION, status: "assigned" }))).toBe(false);
    expect(isActive(makeCase({ organization: ORGANIZATION, status: "in_progress" }))).toBe(true);
    expect(isActive(makeCase({ status: "rescued" }))).toBe(false);
  });

  it("sorts by AI score with unscored cases last", () => {
    const cases = [
      makeCase({ id: 1, confidence_score: 40 }),
      makeCase({ id: 2, confidence_score: null }),
      makeCase({ id: 3, confidence_score: 91 }),
    ];
    expect(cases.sort(byScore).map((item) => item.id)).toEqual([3, 1, 2]);
  });

  it("falls back to species and area when a case has no title", () => {
    expect(caseTitle(makeCase({ title: "", species: "dog", area: "G-11" }))).toBe("Dog case · G-11");
  });
});

describe("notification links", () => {
  const note = (data: AppNotification["data"]): AppNotification => ({
    id: 1, kind: "adoption", title: "", body: "", data, unread: true, created_at: "",
  });

  it("sends organizations to their workspace pages", () => {
    expect(notificationLink(note({ type: "adoption_application", application_id: 4 }), true)).toBe("/applications?application=4");
    expect(notificationLink(note({ type: "critical_case", case_id: 7 }), true)).toBe("/cases/7");
    expect(notificationLink(note({ type: "shelter_donation", donation_id: 2 }), true)).toBe("/funds");
    expect(notificationLink(note({ type: "chat_message", conversation_id: 5 }), true)).toBe("/messages/5");
  });

  it("sends reporters to their own pages", () => {
    expect(notificationLink(note({ type: "case_status", case_id: 7 }), false)).toBe("/case/7");
    expect(notificationLink(note({ type: "adoption_decision" }), false)).toBe("/my-applications");
    expect(notificationLink(note({ type: "unknown" }), false)).toBeNull();
  });
});
