import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import Messages from "../Messages";
import { renderPage } from "../../test/render";
import * as chat from "../../services/chatService";
import type { ChatMessage, ConversationDetail } from "../../types/api";

jest.mock("../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../services/chatService", () => ({ getInbox: jest.fn(), getConversation: jest.fn(), getMessages: jest.fn(), sendMessage: jest.fn() }));
jest.mock("../../services/platformService", () => ({ getOrganizationProfile: jest.fn().mockResolvedValue(null) }));
jest.mock("../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const c = chat as jest.Mocked<typeof chat>;

const CONVERSATION: ConversationDetail = {
  id: 5, topic: "rescue", title: "Zainab Qureshi", avatar: null, initials: "ZQ", verified: false, is_organization: false,
  tag: { label: "Case #SA-2026-0021", tone: "amber" }, unread_count: 0, active: false, last_message_at: "2026-10-06T03:44:10Z",
  last_message: { body: "Taking him to the clinic now.", has_image: false, from_me: true, created_at: "2026-10-06T03:44:10Z" },
  phone: "", last_active: null, organization_id: 9, animal: null,
  case: { id: 21, reference: "SA-2026-0021", status: "in_progress", status_label: "In Progress", title: "Injured Dog", area: "F-10", severity: "medium", live: true },
};

const message = (id: number, body: string, from_me = false): ChatMessage => ({
  id, body, image: null, created_at: "2026-10-06T03:44:10Z", from_me, from_organization: from_me, sender_name: from_me ? "Paws" : "Zainab Qureshi",
});

describe("Messages", () => {
  beforeEach(() => {
    c.getInbox.mockResolvedValue({ results: [CONVERSATION], total: 1, response_minutes: 16 });
    c.getConversation.mockResolvedValue(CONVERSATION);
    c.getMessages.mockResolvedValue([message(13, "I reported the dog in F-10 park.")]);
  });

  it("shows the inbox with the case the chat is about", async () => {
    renderPage(<Messages />, { path: "/messages/:conversationId?", route: "/messages" });
    expect(await screen.findByText("Case #SA-2026-0021")).toBeInTheDocument();
    expect(screen.getByText("You: Taking him to the clinic now.")).toBeInTheDocument();
  });

  it("sends with Enter and links to the case", async () => {
    c.sendMessage.mockResolvedValue(message(14, "We're on the way.", true));
    renderPage(<Messages />, { path: "/messages/:conversationId", route: "/messages/5" });

    expect(await screen.findByText("I reported the dog in F-10 park.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SA-2026-0021 · In Progress" })).toHaveAttribute("href", "/cases/21");

    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "We're on the way." } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(c.sendMessage).toHaveBeenCalledWith("5", "We're on the way.", null));
    expect(await screen.findByText("We're on the way.")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  it("polls for new messages after the last one", async () => {
    jest.useFakeTimers();
    try {
      renderPage(<Messages />, { path: "/messages/:conversationId", route: "/messages/5" });
      await screen.findByText("I reported the dog in F-10 park.");
      c.getMessages.mockResolvedValueOnce([message(15, "Is he okay?")]);
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(c.getMessages).toHaveBeenLastCalledWith("5", 13);
      expect(await screen.findByText("Is he okay?")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
