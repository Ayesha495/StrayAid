import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PostCard from "../PostCard";
import { StoryComposer } from "../Composers";
import { renderPage, REPORTER_USER } from "../../../test/render";
import { ORGANIZATION } from "../../../test/fixtures";
import * as posts from "../../../services/postService";
import type { Animal, Post } from "../../../types/platform";
import type { PostComment } from "../../../types/api";

jest.mock("../../../api/axios", () => ({ __esModule: true, default: {}, PublicAPI: {} }));
jest.mock("../../../services/postService", () => ({
  setPostLiked: jest.fn(), setPostSaved: jest.fn(), sharePost: jest.fn().mockResolvedValue({ share_count: 1 }), deletePost: jest.fn(),
  getComments: jest.fn(), addComment: jest.fn(), deleteComment: jest.fn(), setCommentLiked: jest.fn(), togglePinComment: jest.fn(),
  createStory: jest.fn(),
}));
jest.mock("../../../services/platformService", () => ({ getOrganizationProfile: jest.fn(async () => ORGANIZATION) }));
jest.mock("../../../services/notificationService", () => ({ getUnreadCounts: jest.fn().mockResolvedValue({ notifications: 0, messages: 0 }) }));

const p = posts as jest.Mocked<typeof posts>;

const SUNNY = { id: 14, name: "Sunny", species: "Dog", breed: "Golden Retriever mix", status: "recovering", image: null, organization: ORGANIZATION } as unknown as Animal;
const POST: Post = {
  id: 30, title: "Sunny is eating again", content: "Great news from the clinic.", category: "medical", image: null,
  created_at: "2026-10-06T03:09:08Z", animal: SUNNY, organization: ORGANIZATION, like_count: 1, comment_count: 1, liked_by_me: false, saved_by_me: false,
};

const comment = (overrides: Partial<PostComment> = {}): PostComment => ({
  id: 42, body: "Cute puppy", created_at: "2026-10-05T18:08:13Z", is_pinned: false,
  author: { id: 2, name: "Ayesha", initials: "A", avatar: null, badge: "", is_organization: false, verified: false },
  like_count: 0, liked_by_me: false, replies: [], can_delete: false, can_pin: false, ...overrides,
});

describe("Post card", () => {
  beforeEach(() => jest.clearAllMocks());

  it("likes a post and rolls back if the server fails", async () => {
    p.setPostLiked.mockResolvedValueOnce({ liked_by_me: true, like_count: 2 }).mockRejectedValueOnce(new Error("offline"));
    renderPage(<PostCard post={POST} />, { user: REPORTER_USER });
    const like = await screen.findByRole("button", { pressed: false, name: /likes/ });

    fireEvent.click(like);
    await waitFor(() => expect(like).toHaveTextContent("2"));
    expect(p.setPostLiked).toHaveBeenCalledWith(30, true);

    fireEvent.click(like);
    await waitFor(() => expect(like).toHaveAttribute("aria-pressed", "true"));
  });

  it("asks guests to log in instead of liking", async () => {
    renderPage(<PostCard post={POST} />, { user: null });
    fireEvent.click(screen.getByRole("button", { name: /likes/ }));
    expect(await screen.findByText("Log in to do that")).toBeInTheDocument();
    expect(p.setPostLiked).not.toHaveBeenCalled();
  });

  it("lets the post's organization pin and delete comments", async () => {
    p.getComments.mockResolvedValue({ count: 1, results: [comment({ can_delete: true, can_pin: true })] });
    p.togglePinComment.mockResolvedValue({ is_pinned: true });
    renderPage(<PostCard post={POST} initiallyOpen />);

    const row = (await screen.findByText("Cute puppy")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /Pin/ }));
    await waitFor(() => expect(p.togglePinComment).toHaveBeenCalledWith(42));
    expect(within(row).getByRole("button", { name: /Delete/ })).toBeInTheDocument();
    // The organization can also edit its own post.
    expect(screen.getByRole("button", { name: "Post options" })).toBeInTheDocument();
  });

  it("posts a reply to a comment", async () => {
    p.getComments.mockResolvedValue({ count: 1, results: [comment()] });
    p.addComment.mockResolvedValue(comment({ id: 43, body: "Thanks!" }));
    renderPage(<PostCard post={POST} initiallyOpen />, { user: REPORTER_USER });

    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Comment" }), { target: { value: "Thanks!" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(p.addComment).toHaveBeenCalledWith(30, "Thanks!", 42));
    expect(screen.queryByRole("button", { name: "Post options" })).not.toBeInTheDocument();
  });
});

describe("Story composer", () => {
  it("needs a photo and sends the story", async () => {
    const onSaved = jest.fn();
    p.createStory.mockResolvedValue({ id: 1 } as never);
    render(<StoryComposer animals={[SUNNY]} onClose={jest.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByPlaceholderText(/Day 3/), { target: { value: "Sunny's first walk" } });
    fireEvent.change(screen.getByLabelText("About an animal (optional)"), { target: { value: "14" } });
    const file = new File(["x"], "walk.png", { type: "image/png" });
    global.URL.createObjectURL = jest.fn(() => "blob:walk");
    fireEvent.change(screen.getByLabelText(/^Photo/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const sent = p.createStory.mock.calls[0][0];
    expect(sent.get("headline")).toBe("Sunny's first walk");
    expect(sent.get("animal_id")).toBe("14");
    expect(sent.get("category")).toBe("rescue_update");
    expect(sent.get("image")).toBe(file);
  });
});
