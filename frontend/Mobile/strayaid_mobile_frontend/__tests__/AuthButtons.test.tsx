import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { GoogleButton, GoogleTermsNote, PrimaryButton } from "../components/auth/AuthButtons";
import { unlabelledTappables } from "../test/a11y";

describe("Auth buttons", () => {
  it("says that continuing with Google accepts the terms, with links to both policies", () => {
    render(<GoogleTermsNote />);
    expect(screen.getByText(/By continuing with Google, you agree to the/)).toBeTruthy();
    fireEvent.press(screen.getByRole("link", { name: "Privacy Policy" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "privacy" } });
  });

  it("announces busy and disabled states", () => {
    render(<PrimaryButton label="Sign in" onPress={jest.fn()} loading />);
    expect(screen.getByRole("button", { name: "Sign in" }).props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it("labels the Google button", () => {
    const onPress = jest.fn();
    render(<GoogleButton onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(onPress).toHaveBeenCalled();
    expect(unlabelledTappables(screen.UNSAFE_root)).toEqual([]);
  });
});
