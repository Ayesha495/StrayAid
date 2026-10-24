import { LEGAL_DOCS, POLICY_ORDER } from "../constants/legal";
// The website shows the same policies; both must say exactly the same thing.
import { LEGAL_DOCS as WEB_DOCS, LEGAL_DOC_ORDER as WEB_ORDER } from "../../../Web/strayaid_web_frontend/src/content/legal";

describe("Policies", () => {
  it("has every policy the website has, in the same order", () => {
    expect(POLICY_ORDER).toEqual(WEB_ORDER);
  });

  it.each(WEB_ORDER)("%s matches the website word for word", (key) => {
    expect(LEGAL_DOCS[key]).toEqual(WEB_DOCS[key]);
  });

  it("keeps the volunteer guidelines for the profile screen", () => {
    expect(LEGAL_DOCS.guidelines.sections.length).toBeGreaterThan(0);
  });

  it("explains in-app account deletion the way the app actually does it", () => {
    const howTo = LEGAL_DOCS["delete-account"].sections[0].body;
    expect(howTo).toMatch(/Profile, then Settings, then Delete account/);
  });
});
