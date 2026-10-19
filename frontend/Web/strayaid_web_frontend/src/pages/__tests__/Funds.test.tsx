import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import Funds from "../Funds";
import { renderPage } from "../../test/render";
import { ORGANIZATION } from "../../test/fixtures";
import * as funding from "../../services/fundingService";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/fundingService", () => ({
  getSponsorships: jest.fn(), getDonations: jest.fn(), getOrganizationStats: jest.fn(), reviewSponsorship: jest.fn(), reviewDonation: jest.fn(),
}));
jest.mock("../../services/platformService", () => ({
  getOrganizationProfile: jest.fn(async () => ORGANIZATION),
  getOrganizationAnimals: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const f = funding as jest.Mocked<typeof funding>;
const SUNNY = { id: 14, name: "Sunny", species: "Dog", status: "recovering", image: null };

describe("Funds", () => {
  beforeEach(() => {
    f.getSponsorships.mockResolvedValue([
      { id: 1, animal: SUNNY, sponsor_name: "Zainab Qureshi", amount_pkr: 500, monthly: true, receipt: "http://x/r.png", status: "pending", created_at: new Date().toISOString() },
      { id: 2, animal: SUNNY, sponsor_name: "Ali Raza", amount_pkr: 1500, monthly: false, receipt: null, status: "confirmed", created_at: new Date().toISOString() },
    ]);
    f.getDonations.mockResolvedValue([
      { id: 7, donor_name: "Bilal Hussain", organization: { id: 9, name: "Paws" }, amount_pkr: 3000, receipt: null, status: "pending", created_at: new Date().toISOString() },
    ]);
    f.getOrganizationStats.mockResolvedValue({ stats: { rescued: 3, adopted: 0, in_care: 3, followers: 2, active_cases: 1 }, fund: { month: "October", goal_pkr: 20000, raised_pkr: 1500, percent: 8 }, type: "rescue", is_available: true, following: false, my_pending_donation: false });
  });

  it("puts sponsorship and donation receipts in one queue", async () => {
    renderPage(<Funds />, { path: "/funds", route: "/funds" });
    expect(await screen.findByText("Zainab Qureshi")).toBeInTheDocument();
    expect(screen.getByText("Bilal Hussain")).toBeInTheDocument();
    expect(screen.getByText("Rs 3,500 waiting")).toBeInTheDocument();
    expect(await screen.findByText("Rs 1,500 of Rs 20,000")).toBeInTheDocument();
    expect(screen.queryByText("Ali Raza")).not.toBeInTheDocument();
  });

  it("confirms a sponsorship and rejects a donation with the right calls", async () => {
    f.reviewSponsorship.mockResolvedValue({} as never);
    f.reviewDonation.mockResolvedValue({ id: 7, status: "rejected" });
    renderPage(<Funds />, { path: "/funds", route: "/funds" });

    const zainab = (await screen.findByText("Zainab Qureshi")).closest("li") as HTMLElement;
    fireEvent.click(within(zainab).getByRole("button", { name: /Confirm/ }));
    await waitFor(() => expect(f.reviewSponsorship).toHaveBeenCalledWith(1, "confirmed"));

    const bilal = screen.getByText("Bilal Hussain").closest("li") as HTMLElement;
    fireEvent.click(within(bilal).getByRole("button", { name: /Reject/ }));
    await waitFor(() => expect(f.reviewDonation).toHaveBeenCalledWith(7, "rejected"));
    expect(await screen.findByText("All receipts checked")).toBeInTheDocument();
  });
});
