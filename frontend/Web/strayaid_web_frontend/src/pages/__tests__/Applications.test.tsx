import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import Applications from "../Applications";
import { renderPage } from "../../test/render";
import * as funding from "../../services/fundingService";
import * as chat from "../../services/chatService";
import type { AdoptionApplication } from "../../types/api";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/fundingService", () => ({ getApplications: jest.fn(), decideApplication: jest.fn() }));
jest.mock("../../services/chatService", () => ({ startConversation: jest.fn() }));
jest.mock("../../services/platformService", () => ({ getOrganizationProfile: jest.fn().mockResolvedValue(null) }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const f = funding as jest.Mocked<typeof funding>;
const c = chat as jest.Mocked<typeof chat>;

const LUNA = { id: 15, name: "Luna", species: "Cat", status: "adoptable", image: null };
const MAX = { id: 16, name: "Max", species: "Dog", status: "adoptable", image: null };

const application = (id: number, full_name: string, animal = LUNA, extra: Partial<AdoptionApplication> = {}): AdoptionApplication => ({
  id, animal, animal_name: animal.name, status: "pending", created_at: "2026-10-06T01:09:09Z", decided_at: null, full_name,
  phone: "+92 300 0000000", home_type: "house", has_other_pets: false, city: "Islamabad", ownership: "own",
  landlord_allows_pets: null, household_size: 3, has_children: false, hours_alone: 2, experience: "some",
  reason: "We love cats.", care_plan: "Family helps.", agrees_home_visit: true, agrees_return_policy: true, ...extra,
});

describe("Adoption applications", () => {
  beforeEach(() => {
    f.getApplications.mockResolvedValue([
      application(2, "Usman Tariq"),
      application(3, "Hina Malik", LUNA, { home_type: "apartment", ownership: "rent", landlord_allows_pets: true }),
      application(4, "Bilal Hussain", MAX),
      application(5, "Old Applicant", LUNA, { status: "rejected" }),
    ]);
  });

  it("groups pending applicants by animal", async () => {
    renderPage(<Applications />, { path: "/applications", route: "/applications" });
    const luna = (await screen.findByText("Luna")).closest("section") as HTMLElement;
    expect(within(luna).getByText("2 applicants")).toBeInTheDocument();
    expect(within(luna).queryByText("Old Applicant")).not.toBeInTheDocument();
    expect(screen.getByText("Max").closest("section")).toHaveTextContent("Bilal Hussain");
  });

  it("compares applicants side by side", async () => {
    renderPage(<Applications />, { path: "/applications", route: "/applications" });
    fireEvent.click((await screen.findAllByRole("button", { name: /Compare/ }))[0]);
    const dialog = screen.getByRole("dialog", { name: "Compare applicants for Luna" });
    expect(within(dialog).getByText("Rents (pets allowed)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hina Malik" })).toBeInTheDocument();
  });

  it("approves after warning that other applicants are declined", async () => {
    f.decideApplication.mockResolvedValue(application(2, "Usman Tariq", LUNA, { status: "approved" }));
    renderPage(<Applications />, { path: "/applications", route: "/applications?application=2" });

    fireEvent.click(await screen.findByRole("button", { name: /^Approve$/ }));
    const dialog = screen.getByRole("dialog", { name: "Approve Usman Tariq?" });
    expect(dialog).toHaveTextContent("The other 1 pending application is declined automatically.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve adoption" }));

    await waitFor(() => expect(f.decideApplication).toHaveBeenCalledWith(2, "approved"));
    expect(await screen.findByText("Luna is adopted!")).toBeInTheDocument();
  });

  it("opens a chat with the applicant", async () => {
    c.startConversation.mockResolvedValue({ id: 12 });
    renderPage(<Applications />, { path: "/applications", route: "/applications?application=3" });
    fireEvent.click(await screen.findByRole("button", { name: /Message applicant/ }));
    await waitFor(() => expect(c.startConversation).toHaveBeenCalledWith({ application_id: 3 }));
    expect(await screen.findByText("Other page")).toBeInTheDocument();
  });
});
