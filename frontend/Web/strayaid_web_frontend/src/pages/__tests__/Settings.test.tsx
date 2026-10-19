import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Settings from "../Settings";
import OrgProfileForm from "../../components/OrgProfileForm";
import { renderPage, REPORTER_USER } from "../../test/render";
import * as account from "../../services/accountService";
import * as platform from "../../services/platformService";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Circle: () => null, CircleMarker: () => null,
  useMap: () => ({ setView: jest.fn(), getZoom: () => 11 }), useMapEvents: () => null,
}));
jest.mock("../../services/accountService", () => ({ getMyProfile: jest.fn(), updateMyProfile: jest.fn(), changePassword: jest.fn() }));
jest.mock("../../services/platformService", () => ({ getOrganizationProfile: jest.fn(), createOrganizationProfile: jest.fn(), updateOrganizationProfile: jest.fn() }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const a = account as jest.Mocked<typeof account>;
const p = platform as jest.Mocked<typeof platform>;

describe("Account settings", () => {
  beforeEach(() => {
    a.getMyProfile.mockResolvedValue({ id: 26, email: "ali.raza@strayaid.local", first_name: "Ali", last_name: "Raza", role: "public", avatar: null, area: "", phone: "", member_since: "2026-10-04T00:00:00Z" });
  });

  it("checks the new password before sending it", async () => {
    a.changePassword.mockResolvedValue();
    renderPage(<Settings />, { user: REPORTER_USER });
    fireEvent.change(await screen.findByLabelText("Current password"), { target: { value: "demo12345" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText("Repeat new password"), { target: { value: "different1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("don't match");
    expect(a.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Repeat new password"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(a.changePassword).toHaveBeenCalledWith("demo12345", "newpass123"));
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
  });

  it("offers reporters to register an organization", async () => {
    renderPage(<Settings />, { user: REPORTER_USER });
    expect(await screen.findByRole("link", { name: "Register organization" })).toHaveAttribute("href", "/organization/register");
  });
});

describe("Organization profile form", () => {
  it("needs a base location before creating the organization", async () => {
    const onSaved = jest.fn();
    p.createOrganizationProfile.mockResolvedValue({ id: 50, name: "New Rescue" } as never);
    render(<OrgProfileForm onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Rescue" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+92 300 1112223" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "F-6, Islamabad" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("base location");
    expect(p.createOrganizationProfile).not.toHaveBeenCalled();
  });
});
