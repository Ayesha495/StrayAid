import { fireEvent, screen, waitFor } from "@testing-library/react";
import OrganizationRegistration from "../OrganizationRegistration";
import { renderPage, REPORTER_USER } from "../../test/render";
import * as platform from "../../services/platformService";

jest.mock("../../api/axios", () => ({ __esModule: true, default: { get: jest.fn().mockResolvedValue({ data: {} }) }, PublicAPI: {} }));
jest.mock("../../components/LocationPicker", () => ({
  __esModule: true,
  default: ({ onLocationChange, onAddressChange }: {
    onLocationChange: (value: { latitude: number; longitude: number }) => void;
    onAddressChange: (address: string) => void;
  }) => (
    <button type="button" onClick={() => { onLocationChange({ latitude: 33.7, longitude: 73.05 }); onAddressChange("F-7, Islamabad"); }}>
      Drop pin
    </button>
  ),
}));
jest.mock("../../services/platformService", () => ({
  getOrganizationProfile: jest.fn(),
  createOrganizationProfile: jest.fn(),
  updateOrganizationProfile: jest.fn(),
}));
jest.mock("../../services/notificationService", () => ({
  getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }),
  getNotifications: jest.fn().mockResolvedValue([]),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  clearReadNotifications: jest.fn(),
}));

const p = platform as jest.Mocked<typeof platform>;

async function reachReviewStep() {
  p.getOrganizationProfile.mockRejectedValue({ response: { status: 404 } });
  renderPage(<OrganizationRegistration />, { user: REPORTER_USER, path: "/organization/register", route: "/organization/register" });
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Safe Paws" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Drop pin" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+92 300 1112223" } });
  fireEvent.change(screen.getByLabelText("Contact Email"), { target: { value: "team@safepaws.pk" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

describe("Registering a rescue team", () => {
  beforeEach(() => jest.spyOn(window, "alert").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("asks the person to confirm they may register the team and that the details are true", async () => {
    await reachReviewStep();
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));
    expect(await screen.findByText(/Confirm you're allowed to register/)).toBeInTheDocument();
    expect(p.createOrganizationProfile).not.toHaveBeenCalled();
  });

  it("creates the team once confirmed", async () => {
    p.createOrganizationProfile.mockResolvedValue({ id: 1, name: "Safe Paws" } as never);
    await reachReviewStep();
    fireEvent.click(screen.getByRole("checkbox", { name: /I'm allowed to register Safe Paws/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create Profile" }));
    await waitFor(() => expect(p.createOrganizationProfile).toHaveBeenCalled());
  });

  it("doesn't call bank details verified, because StrayAid doesn't verify them", async () => {
    await reachReviewStep();
    expect(document.body.textContent).not.toMatch(/verified banking/i);
  });
});
