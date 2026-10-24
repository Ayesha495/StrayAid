import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import RegisterPage from "../app/(auth)/register/page";
import { loginUser, registerUser } from "../services/authService";
import { unlabelledTappables } from "../test/a11y";

jest.mock("../services/authService", () => ({
  ...jest.requireActual("../services/authService"),
  registerUser: jest.fn(),
  loginUser: jest.fn(),
}));

const fillIn = () => {
  fireEvent.changeText(screen.getByLabelText("Full name"), "Hira Khan");
  fireEvent.changeText(screen.getByLabelText("Email address"), "hira@x.pk");
  fireEvent.changeText(screen.getByLabelText("Password"), "Rescue!Pass2026");
  fireEvent.changeText(screen.getByLabelText("Confirm password"), "Rescue!Pass2026");
};

describe("Sign-up screen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("won't create an account until the terms are accepted", async () => {
    render(<RegisterPage />);
    fillIn();
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Accept the Terms of Service and Privacy Policy/)).toBeTruthy();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("creates the account with the acceptance once the box is ticked", async () => {
    (registerUser as jest.Mock).mockResolvedValue({ id: 1 });
    (loginUser as jest.Mock).mockResolvedValue({ access: "a", refresh: "r" });
    render(<RegisterPage />);
    fillIn();
    const box = screen.getByRole("checkbox", { name: /I agree to the Terms of Service and Privacy Policy/ });
    expect(box.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    fireEvent.press(box);
    fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(registerUser).toHaveBeenCalledWith(expect.objectContaining({ email: "hira@x.pk", acceptTerms: true })));
  });

  it("opens the terms and the privacy policy from the consent text", () => {
    render(<RegisterPage />);
    fireEvent.press(screen.getByRole("link", { name: "Terms of Service" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "terms" } });
    fireEvent.press(screen.getByRole("link", { name: "Privacy Policy" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "privacy" } });
  });

  it("labels everything a screen reader can tap", () => {
    render(<RegisterPage />);
    expect(unlabelledTappables(screen.UNSAFE_root)).toEqual([]);
  });
});
