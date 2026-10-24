import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../Login";
import Register from "../Register";
import ForgotPassword from "../ForgotPassword";
import AnimalDirectory from "../AnimalDirectory";
import API from "../../api/axios";
import * as platform from "../../services/platformService";
import type { Animal } from "../../types/platform";

jest.mock("../../api/axios", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() }, PublicAPI: {} }));
jest.mock("../../services/platformService", () => ({ getPublicAnimals: jest.fn(), getPublicOrganization: jest.fn() }));

const api = API as unknown as { post: jest.Mock; get: jest.Mock };
const ORG = { id: 1, email: "team@x.pk", username: "team", first_name: "", last_name: "", role: "organization" };
const PERSON = { id: 2, email: "new@x.pk", username: "new", first_name: "New", last_name: "", role: "public" };

/** A fake Google Identity Services client: "ok" signs in, anything else is the popup failing that way. */
function fakeGoogle(outcome: "ok" | "popup_closed") {
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => ({
          requestAccessToken: () => {
            if (outcome === "ok") config.callback({ access_token: "google-token" });
            else config.error_callback?.({ type: outcome });
          },
        }),
      },
    },
  };
}

function renderAt(ui: ReactElement, path: string, route = path) {
  localStorage.clear();
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="/feed" element={<div>Feed page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/organization/register" element={<div>Team details page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  delete window.google;
  jest.clearAllMocks();
});

describe("Continue with Google", () => {
  it("signs a person in and takes them to the feed, not the org-only dashboard", async () => {
    fakeGoogle("ok");
    api.post.mockResolvedValue({ data: { access: "a", refresh: "r", user: PERSON } });
    renderAt(<Login />, "/login");
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByText("Feed page")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/auth/google/", { access_token: "google-token", accept_terms: true });
    expect(JSON.parse(localStorage.getItem("currentUser") ?? "{}").email).toBe("new@x.pk");
  });

  it("takes a rescue team to its dashboard", async () => {
    fakeGoogle("ok");
    api.post.mockResolvedValue({ data: { access: "a", refresh: "r", user: ORG } });
    renderAt(<Login />, "/login");
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("stores the account when signing up, so the app doesn't bounce back to login", async () => {
    fakeGoogle("ok");
    api.post.mockResolvedValue({ data: { access: "a", refresh: "r", user: PERSON } });
    renderAt(<Register />, "/register", "/register?as=organization");
    expect(screen.getByRole("radio", { name: /A rescue team/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sign up with Google/ }));
    expect(await screen.findByText("Team details page")).toBeInTheDocument();
    expect(localStorage.getItem("access")).toBe("a");
    expect(localStorage.getItem("currentUser")).toContain("new@x.pk");
  });

  it("says so when the Google window is closed", async () => {
    fakeGoogle("popup_closed");
    renderAt(<Login />, "/login");
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The Google window was closed before signing in.");
    expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeEnabled();
  });
});

describe("Forgot password", () => {
  it("emails a code, then resets the password with it", async () => {
    api.post
      .mockResolvedValueOnce({ data: { detail: "If an account exists for that email, we've sent a 6-digit code to it." } })
      .mockResolvedValueOnce({ data: { detail: "Your password has been reset. You can sign in now." } });
    renderAt(<ForgotPassword />, "/forgot-password");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ali@x.pk" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "12a3456" } });
    expect(screen.getByLabelText("6-digit code")).toHaveValue("123456");
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith("/auth/password-reset/confirm/", { email: "ali@x.pk", code: "123456", new_password: "newpass123" });
  });
});

describe("Meet the animals", () => {
  const animal = (id: number, name: string, status: string, species: string, goal = 0, raised = 0) =>
    ({ id, name, status, species, breed: "", description: "", image: null, funding_goal_pkr: goal, raised_pkr: raised, created_at: "2026-10-01T00:00:00Z", organization: null } as unknown as Animal);

  it("filters by what an animal needs and puts the biggest funding gap first", async () => {
    (platform.getPublicAnimals as jest.Mock).mockResolvedValue([
      animal(1, "Luna", "adoptable", "Cat", 15000, 1500),
      animal(2, "Sunny", "recovering", "Dog", 30000, 2000),
      animal(3, "Buddy", "recovering", "Dog", 18000, 1000),
      animal(4, "Bella", "adopted", "Dog"),
    ]);
    renderAt(<AnimalDirectory />, "/animals/browse");

    fireEvent.click(await screen.findByRole("button", { name: /Needs sponsors/ }));
    const names = screen.getAllByRole("link").map((link) => link.textContent).filter((text) => ["Sunny", "Buddy", "Luna", "Bella"].includes(text ?? ""));
    expect(names).toEqual(["Sunny", "Buddy"]);

    fireEvent.click(screen.getByRole("button", { name: "Cats" }));
    await waitFor(() => expect(screen.getByText("No animals match")).toBeInTheDocument());
    expect(within(screen.getByRole("group", { name: "What they need" })).getByRole("button", { name: /Looking for a home/ })).toHaveTextContent("1");
  });
});

describe("Sign up consent", () => {
  const fillIn = () => {
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newbie" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@x.pk" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Rescue!Pass2026" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Rescue!Pass2026" } });
  };

  it("can't create an account until the terms are accepted", async () => {
    renderAt(<Register />, "/register");
    fillIn();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Accept the Terms of Service and Privacy Policy/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends the acceptance with the sign-up", async () => {
    api.post
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { access: "a", refresh: "r" } });
    api.get.mockResolvedValue({ data: PERSON });
    renderAt(<Register />, "/register");
    fillIn();
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the Terms of Service and Privacy Policy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Feed page")).toBeInTheDocument();
    expect(api.post).toHaveBeenNthCalledWith(1, "/auth/users/", expect.objectContaining({ email: "new@x.pk", accept_terms: true }));
  });

  it("links the terms and privacy policy from the checkbox, opening in a new tab", () => {
    renderAt(<Register />, "/register");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("target", "_blank");
  });

  it("tells people that continuing with Google means accepting the terms", () => {
    renderAt(<Login />, "/login");
    expect(screen.getByText(/By continuing with Google, you agree to/)).toBeInTheDocument();
  });

  it("puts the form fields in a sensible keyboard order with labels", () => {
    renderAt(<Register />, "/register");
    const fields = ["Username", "Email", "Password", "Confirm password"].map((label) => screen.getByLabelText(label));
    fields.forEach((field) => expect(field).not.toHaveAttribute("tabindex", "-1"));
    expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeRequired();
  });
});
