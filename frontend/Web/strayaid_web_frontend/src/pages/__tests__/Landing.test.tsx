import { screen, within } from "@testing-library/react";
import LandingPage from "../LandingPage";
import { renderPage } from "../../test/render";
import * as cases from "../../services/caseService";
import * as platform from "../../services/platformService";
import * as social from "../../services/socialService";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/platformService", () => ({ getPublicAnimals: jest.fn() }));
jest.mock("../../services/caseService", () => ({ getCommunityStats: jest.fn() }));
jest.mock("../../services/socialService", () => ({ getDirectory: jest.fn() }));

const c = cases as jest.Mocked<typeof cases>;
const p = platform as jest.Mocked<typeof platform>;
const s = social as jest.Mocked<typeof social>;

function openLanding({ rescued = 0, teams = 0 } = {}) {
  c.getCommunityStats.mockResolvedValue({ rescued_total: rescued, rescued_today: 0 });
  p.getPublicAnimals.mockResolvedValue([]);
  s.getDirectory.mockResolvedValue(Array.from({ length: teams }, (_, id) => ({ id })) as never);
  return renderPage(<LandingPage />, { user: null });
}

describe("Landing page", () => {
  it("shows no made-up testimonials", async () => {
    openLanding();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /people who've used it/i })).not.toBeInTheDocument();
    for (const name of ["Zainab Qureshi", "Sara Ahmed", "Bilal Hussain"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("makes no claims the app can't back up", async () => {
    const { container } = openLanding();
    await screen.findByRole("heading", { level: 1 });
    expect(container.textContent).not.toMatch(/under a minute|finds the closest team|is alerted/i);
  });

  it("only shows community numbers once there are real ones", async () => {
    openLanding();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Animals rescued")).not.toBeInTheDocument();
  });

  it("shows community numbers when rescues have happened", async () => {
    openLanding({ rescued: 12, teams: 3 });
    const numbers = await screen.findByRole("region", { name: "StrayAid so far" });
    expect(within(numbers).getByText("Animals rescued")).toBeInTheDocument();
    expect(within(numbers).getByText("Rescue teams")).toBeInTheDocument();
  });

  it("links every policy and who runs StrayAid from the footer", async () => {
    openLanding();
    const footer = await screen.findByRole("contentinfo");
    for (const name of ["Terms of Service", "Privacy Policy", "Cookie Policy", "Donations & Refunds", "Delete your account"]) {
      expect(within(footer).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(footer).getByText(/final-year project/i)).toBeInTheDocument();
  });

  it("credits where the photos come from", async () => {
    openLanding();
    const footer = await screen.findByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Pexels" })).toHaveAttribute("href", "https://www.pexels.com");
  });

  it("gives every photo a description", async () => {
    const { container } = openLanding();
    await screen.findByRole("heading", { level: 1 });
    container.querySelectorAll("img").forEach((image) => expect(image).toHaveAttribute("alt"));
  });
});
