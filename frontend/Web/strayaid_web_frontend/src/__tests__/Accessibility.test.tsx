import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import LegalPage from "../pages/LegalPage";
import NotFound from "../pages/NotFound";
import Settings from "../pages/Settings";
import { LEGAL_DOC_ORDER } from "../content/legal";
import { renderPage, REPORTER_USER } from "../test/render";
import * as account from "../services/accountService";

jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null, Circle: () => null, CircleMarker: () => null, Marker: () => null,
  useMap: () => ({ setView: jest.fn(), getZoom: () => 11 }), useMapEvents: () => null,
}));
jest.mock("../api/axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() }, PublicAPI: {} }));
jest.mock("../services/platformService", () => ({ getPublicAnimals: jest.fn().mockResolvedValue([]) }));
jest.mock("../services/caseService", () => ({ getCommunityStats: jest.fn().mockResolvedValue({ rescued_total: 4, rescued_today: 0 }) }));
jest.mock("../services/socialService", () => ({ getDirectory: jest.fn().mockResolvedValue([]) }));
jest.mock("../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));
jest.mock("../services/accountService", () => ({ getMyProfile: jest.fn(), updateMyProfile: jest.fn(), changePassword: jest.fn(), deleteAccount: jest.fn() }));

const a = account as jest.Mocked<typeof account>;

// jsdom can't measure colours, so contrast is checked separately against the design tokens.
const AXE_OPTIONS = { rules: { "color-contrast": { enabled: false } } };

async function expectAccessible(ui: ReactElement, options: Parameters<typeof renderPage>[1] = { user: null }) {
  const { container } = renderPage(ui, options);
  await screen.findAllByRole("heading", { level: 1 });
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

describe("Accessibility (axe)", () => {
  it("landing page", () => expectAccessible(<LandingPage />));
  it("log in", () => expectAccessible(<Login />));
  it("sign up", () => expectAccessible(<Register />));
  it("forgot password", () => expectAccessible(<ForgotPassword />));
  it("page not found", () => expectAccessible(<NotFound />));

  it.each(LEGAL_DOC_ORDER)("%s policy", (doc) =>
    expectAccessible(<LegalPage />, { user: null, path: "/legal/:doc", route: `/legal/${doc}` }),
  );

  it("settings, including the delete-account dialog", async () => {
    a.getMyProfile.mockResolvedValue({ id: 26, email: "a@x.pk", first_name: "Ali", last_name: "", role: "public", avatar: null, area: "", phone: "", member_since: "2026-10-04T00:00:00Z" });
    const { container } = renderPage(<main><Settings /></main>, { user: REPORTER_USER });
    (await screen.findByRole("button", { name: "Delete account…" })).click();
    await screen.findByRole("dialog");
    expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
    expect(container).toBeInTheDocument();
  });
});
