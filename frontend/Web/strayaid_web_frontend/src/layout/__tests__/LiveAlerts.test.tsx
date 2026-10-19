import { act, screen } from "@testing-library/react";
import LiveAlerts from "../LiveAlerts";
import { renderPage } from "../../test/render";
import { makeCase } from "../../test/fixtures";
import * as platform from "../../services/platformService";
import * as notifications from "../../services/notificationService";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/platformService", () => ({ getNearbyCases: jest.fn(), getOrganizationProfile: jest.fn().mockResolvedValue(null) }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn(), getNotifications: jest.fn() }));

const p = platform as jest.Mocked<typeof platform>;
const n = notifications as jest.Mocked<typeof notifications>;

const flush = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe("Live alerts", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("toasts new nearby cases but not the ones already there", async () => {
    n.getUnreadCounts.mockResolvedValue({ notifications: 0, messages: 0 });
    n.getNotifications.mockResolvedValue([]);
    p.getNearbyCases
      .mockResolvedValueOnce([makeCase({ id: 1, title: "Old case" })])
      .mockResolvedValue([makeCase({ id: 1, title: "Old case" }), makeCase({ id: 2, title: "Hit by car — G-9", confidence_score: 88 })]);

    renderPage(<LiveAlerts />);
    await flush();
    expect(screen.queryByText(/Old case/)).not.toBeInTheDocument();

    await flush(60_000);
    expect(screen.getByText("Urgent case nearby")).toBeInTheDocument();
    expect(screen.getByText(/Hit by car — G-9 · 2.2 km away · 88% priority/)).toBeInTheDocument();
    expect(screen.queryByText(/Old case/)).not.toBeInTheDocument();
  });

  it("toasts a new adoption application when the unread count goes up", async () => {
    p.getNearbyCases.mockResolvedValue([]);
    n.getUnreadCounts.mockResolvedValueOnce({ notifications: 0, messages: 0 }).mockResolvedValue({ notifications: 1, messages: 0 });
    n.getNotifications.mockResolvedValueOnce([]).mockResolvedValue([
      { id: 50, kind: "adoption", title: "Adoption", body: "**Hira Malik** wants to adopt **Luna**.", data: { type: "adoption_application", application_id: 9 }, unread: true, created_at: "" },
      { id: 51, kind: "community", title: "Community", body: "Someone liked your post.", data: { type: "post" }, unread: true, created_at: "" },
    ]);

    renderPage(<LiveAlerts />);
    await flush();
    await flush(30_000);

    expect(screen.getByText("Hira Malik wants to adopt Luna.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/applications?application=9");
    // Organizations aren't interrupted for likes.
    expect(screen.queryByText("Someone liked your post.")).not.toBeInTheDocument();
  });
});
