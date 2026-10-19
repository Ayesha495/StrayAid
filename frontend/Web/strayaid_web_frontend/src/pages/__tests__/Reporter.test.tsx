import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CaseProgress from "../../components/CaseProgress";
import MyApplications from "../MyApplications";
import { renderPage, REPORTER_USER } from "../../test/render";
import * as funding from "../../services/fundingService";
import type { AdoptionApplication } from "../../types/api";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/fundingService", () => ({
  getApplications: jest.fn(), getSponsorships: jest.fn(), getDonations: jest.fn(), withdrawApplication: jest.fn(),
}));
jest.mock("../../services/platformService", () => ({ getOrganizationProfile: jest.fn() }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const f = funding as jest.Mocked<typeof funding>;

describe("Case progress", () => {
  it("marks the steps a rescue has reached", () => {
    render(<CaseProgress status="in_progress" />);
    expect(screen.getByText("Rescue under way").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Team assigned").closest("li")).toHaveClass("is-done");
    expect(screen.getByText("Rescued").closest("li")).toHaveClass("is-todo");
  });

  it("treats adoption and closed as a finished rescue", () => {
    render(<CaseProgress status="adoption" />);
    expect(screen.getByText("Rescued").closest("li")).toHaveClass("is-done");
  });
});

describe("Adopt & sponsor", () => {
  it("lets a reporter withdraw a pending application", async () => {
    const pending = { id: 7, animal: { id: 15, name: "Luna", species: "Cat", status: "adoptable", image: null }, status: "pending", created_at: "2026-10-06T00:00:00Z" } as AdoptionApplication;
    f.getApplications.mockResolvedValue([pending]);
    f.getSponsorships.mockResolvedValue([]);
    f.getDonations.mockResolvedValue([]);
    f.withdrawApplication.mockResolvedValue({ ...pending, status: "withdrawn" });
    jest.spyOn(window, "confirm").mockReturnValue(true);

    renderPage(<MyApplications />, { user: REPORTER_USER });
    expect(await screen.findByText(/reviewing your application/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(f.withdrawApplication).toHaveBeenCalledWith(7));
    expect(await screen.findByText(/You withdrew this application/)).toBeInTheDocument();
  });
});
