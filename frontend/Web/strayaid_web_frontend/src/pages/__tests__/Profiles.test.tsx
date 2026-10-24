import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import AnimalDetail from "../AnimalDetail";
import OrganizationPublicProfile from "../OrganizationPublicProfile";
import LandingPage from "../LandingPage";
import { ORG_USER, REPORTER_USER, renderPage } from "../../test/render";
import { ORGANIZATION } from "../../test/fixtures";
import * as platform from "../../services/platformService";
import * as funding from "../../services/fundingService";
import type { Animal } from "../../types/platform";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../components/ServiceAreaMap", () => ({ __esModule: true, default: () => null }));
jest.mock("../landing/Carousels", () => ({
  AnimalCarousel: ({ animals }: { animals: Animal[] }) => <ul>{animals.map((animal) => <li key={animal.id}>{animal.name}</li>)}</ul>,
}));
jest.mock("../../services/platformService", () => ({
  getAnimal: jest.fn(),
  getAnimalPosts: jest.fn().mockResolvedValue([]),
  updateAnimal: jest.fn(),
  getPublicOrganization: jest.fn(),
  getPublicOrganizationAnimals: jest.fn(),
  getPublicAnimals: jest.fn(),
  getOrganizationProfile: jest.fn(),
}));
jest.mock("../../services/socialService", () => ({
  followAnimal: jest.fn(), followOrganization: jest.fn(), sponsorAnimal: jest.fn(), donateToOrganization: jest.fn(),
  getFollowStatus: jest.fn().mockResolvedValue({ following_animal: false }),
  getDirectory: jest.fn().mockResolvedValue([{ id: 9 }, { id: 10 }]),
}));
jest.mock("../../services/caseService", () => ({
  getPublicCase: jest.fn().mockResolvedValue(null),
  getCaseUpdates: jest.fn().mockResolvedValue([]),
  getCommunityStats: jest.fn().mockResolvedValue({ rescued_total: 8, rescued_today: 0 }),
}));
jest.mock("../../services/fundingService", () => ({
  getOrganizationStats: jest.fn().mockResolvedValue({
    stats: { rescued: 3, adopted: 0, in_care: 3, followers: 1, active_cases: 1 },
    fund: { month: "October", goal_pkr: 200000, raised_pkr: 10500, percent: 5 },
    type: "rescue", is_available: true, following: false, my_pending_donation: false,
  }),
  getApplications: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../services/postService", () => ({ getFeed: jest.fn().mockResolvedValue([]) }));
jest.mock("../../services/chatService", () => ({ startConversation: jest.fn() }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const p = platform as jest.Mocked<typeof platform>;
const f = funding as jest.Mocked<typeof funding>;

const animal = (overrides: Partial<Animal>): Animal => ({
  id: 15, name: "Luna", species: "Cat", breed: "Domestic Longhair", description: "Calm and affectionate.", medical_info: "Healthy.",
  donation_info: { bank: "Meezan", account_name: "Paws", account_number: "0101" }, adoption_info: null, status: "adoptable",
  image: "http://x/luna.jpg", case: 23, case_id: 23, organization: ORGANIZATION, created_at: "2026-09-15T00:00:00Z",
  funding_goal_pkr: 15000, raised_pkr: 1500, sponsor_count: 1, ...overrides,
});

describe("Animal profile", () => {
  it("leads with adoption for adoptable animals, with sponsoring as a second option", async () => {
    p.getAnimal.mockResolvedValue(animal({}));
    renderPage(<AnimalDetail />, { user: REPORTER_USER, path: "/animals/:animalId", route: "/animals/15" });
    expect(await screen.findByRole("heading", { name: "Luna", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Apply to adopt Luna/ })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sponsor$/ })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Rs 1,500 of Rs 15,000, 10%");
  });

  it("leads with sponsoring while an animal is still recovering", async () => {
    p.getAnimal.mockResolvedValue(animal({ status: "recovering", name: "Sunny" }));
    renderPage(<AnimalDetail />, { user: REPORTER_USER, path: "/animals/:animalId", route: "/animals/15" });
    expect((await screen.findAllByRole("button", { name: /Sponsor Sunny/ }))[0]).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply to adopt/ })).not.toBeInTheDocument();
  });

  it("lets the animal's organization change the care goal", async () => {
    p.getOrganizationProfile.mockResolvedValue(ORGANIZATION);
    p.getAnimal.mockResolvedValue(animal({}));
    p.updateAnimal.mockResolvedValue(animal({ funding_goal_pkr: 20000 }));
    renderPage(<AnimalDetail />, { user: ORG_USER, path: "/animals/:animalId", route: "/animals/15" });

    fireEvent.click(await screen.findByRole("button", { name: /Edit care goal/ }));
    fireEvent.change(screen.getByLabelText("Care funding goal in rupees"), { target: { value: "20000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(p.updateAnimal).toHaveBeenCalledWith(15, { funding_goal_pkr: 20000 }));
    expect(screen.queryByRole("button", { name: /Apply to adopt/ })).not.toBeInTheDocument();
  });

  it("shows the animal's own team who applied, linking to their applications", async () => {
    p.getOrganizationProfile.mockResolvedValue(ORGANIZATION);
    p.getAnimal.mockResolvedValue(animal({}));
    const application = (id: number, full_name: string, status: "pending" | "approved") =>
      ({ id, full_name, status, city: "Kahuta", home_type: "house", created_at: "2026-10-20T00:00:00Z", animal: { id: 15, name: "Luna" } }) as never;
    f.getApplications.mockResolvedValue([
      application(1, "Maryam Siddiqui", "pending"),
      application(2, "Hina Malik", "pending"),
      { ...(application(3, "Someone Else", "pending") as object), animal: { id: 99, name: "Max" } } as never,
    ]);
    renderPage(<AnimalDetail />, { user: ORG_USER, path: "/animals/:animalId", route: "/animals/15" });

    expect(await screen.findByRole("link", { name: /Maryam Siddiqui/ })).toHaveAttribute("href", "/applications?animal=15&application=1");
    expect(screen.getByRole("link", { name: /Hina Malik/ })).toBeInTheDocument();
    expect(screen.queryByText("Someone Else")).not.toBeInTheDocument(); // another animal's applicant
    expect(screen.getAllByRole("link", { name: /Review 2 applications/ })[0]).toHaveAttribute("href", "/applications?animal=15");
  });
});

describe("Organization profile", () => {
  it("puts the animals furthest from their care goal first", async () => {
    p.getPublicOrganization.mockResolvedValue(ORGANIZATION);
    p.getPublicOrganizationAnimals.mockResolvedValue([
      animal({ id: 1, name: "Luna", funding_goal_pkr: 15000, raised_pkr: 1500 }),
      animal({ id: 2, name: "Sunny", status: "recovering", funding_goal_pkr: 30000, raised_pkr: 2000 }),
      animal({ id: 3, name: "Bella", status: "adopted", funding_goal_pkr: 8000, raised_pkr: 0 }),
    ]);
    renderPage(<OrganizationPublicProfile />, { user: REPORTER_USER, path: "/organizations/:organizationId", route: "/organizations/9" });

    const help = (await screen.findByRole("heading", { name: "Needs your help most" })).closest("section") as HTMLElement;
    const names = within(help).getAllByRole("link").map((link) => link.querySelector("strong")?.textContent);
    expect(names).toEqual(["Sunny", "Luna"]); // the adopted animal isn't asking for help
    expect(screen.getByText("October medical supplies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Give to supplies/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Emergency call/ })).toHaveAttribute("href", "tel:+92 300 0000101");
  });
});

describe("Landing page", () => {
  it("tells the story and shows real animals", async () => {
    p.getPublicAnimals.mockResolvedValue([animal({}), animal({ id: 2, name: "Bella", status: "adopted" })]);
    renderPage(<LandingPage />, { user: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Help injured strays reach a rescue team near you.");
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(await screen.findByRole("heading", { name: "They're waiting for you" })).toBeInTheDocument();
    // Adopted animals aren't "waiting".
    expect(screen.queryByText("Bella")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "From the curb to a couch" })).toBeInTheDocument();
  });
});
