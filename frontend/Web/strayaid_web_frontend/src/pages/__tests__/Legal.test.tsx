import { screen, within } from "@testing-library/react";
import LegalPage from "../LegalPage";
import { LEGAL_DOCS, LEGAL_DOC_ORDER } from "../../content/legal";
import { SITE } from "../../content/site";
import { renderPage } from "../../test/render";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));

const openDoc = (doc: string) => renderPage(<LegalPage />, { user: null, path: "/legal/:doc", route: `/legal/${doc}` });

describe("Legal pages", () => {
  it.each(LEGAL_DOC_ORDER)("shows the %s page with its sections", (key) => {
    openDoc(key);
    const doc = LEGAL_DOCS[key];
    expect(screen.getByRole("heading", { level: 1, name: doc.title })).toBeInTheDocument();
    expect(screen.getByText(`Last updated ${doc.updated}`)).toBeInTheDocument();
    for (const section of doc.sections) {
      expect(screen.getByRole("heading", { level: 2, name: section.heading })).toBeInTheDocument();
    }
  });

  it("covers every policy a live app needs", () => {
    expect(LEGAL_DOC_ORDER).toEqual(["terms", "privacy", "cookies", "donations", "delete-account"]);
  });

  it("links to the other policies", () => {
    openDoc("privacy");
    const nav = screen.getByRole("navigation", { name: "All policies" });
    for (const key of LEGAL_DOC_ORDER) {
      expect(within(nav).getByRole("link", { name: LEGAL_DOCS[key].title })).toHaveAttribute("href", `/legal/${key}`);
    }
    expect(within(nav).getByRole("link", { name: LEGAL_DOCS.privacy.title })).toHaveAttribute("aria-current", "page");
  });

  it("names who runs StrayAid and how to reach them", () => {
    openDoc("privacy");
    expect(screen.getAllByText(new RegExp(SITE.operator)).length).toBeGreaterThan(0);
  });

  it("explains that StrayAid uses no tracking or advertising cookies", () => {
    openDoc("cookies");
    expect(screen.getAllByText(/no advertising or analytics cookies/i).length).toBeGreaterThan(0);
  });

  it("explains refunds are handled by the rescue team, since StrayAid never holds money", () => {
    openDoc("donations");
    expect(screen.getAllByText(/StrayAid never receives or holds/i).length).toBeGreaterThan(0);
  });

  it("explains how to delete an account, even without the app", () => {
    openDoc("delete-account");
    expect(screen.getAllByText(/Settings/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/what is deleted/i).length).toBeGreaterThan(0);
  });

  it("shows the not-found page for an unknown policy", () => {
    openDoc("nonsense");
    expect(screen.getByRole("heading", { name: /couldn't find/i })).toBeInTheDocument();
  });

  it("never promises anything StrayAid doesn't do", () => {
    const allText = Object.values(LEGAL_DOCS)
      .flatMap((doc) => doc.sections.map((section) => section.body))
      .join(" ");
    expect(allText).not.toMatch(/guarantee|100%|always rescued|verified organizations/i);
  });
});
