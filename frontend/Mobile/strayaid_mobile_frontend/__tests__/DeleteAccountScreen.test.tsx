import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import DeleteAccountScreen from "../app/profile/delete-account";
import { deleteAccount, clearLocalSession } from "../services/authService";
import { unlabelledTappables } from "../test/a11y";

jest.mock("../services/authService", () => ({ deleteAccount: jest.fn(), clearLocalSession: jest.fn() }));

describe("Delete account screen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("explains what is deleted and what is kept", () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText(/name, email, phone and photo/)).toBeTruthy();
    expect(screen.getByText(/reports stay/)).toBeTruthy();
  });

  it("only deletes after typing DELETE", async () => {
    (deleteAccount as jest.Mock).mockResolvedValue(undefined);
    render(<DeleteAccountScreen />);
    const button = screen.getByRole("button", { name: "Delete my account" });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    fireEvent.changeText(screen.getByLabelText("Your password"), "demo12345");
    fireEvent.press(screen.getByRole("button", { name: "Delete my account" }));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("demo12345"));
    expect(clearLocalSession).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/home");
  });

  it("keeps the account and shows the reason when the server refuses", async () => {
    (deleteAccount as jest.Mock).mockRejectedValue(new Error("That password isn't right."));
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    fireEvent.press(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByText("That password isn't right.")).toBeTruthy();
    expect(clearLocalSession).not.toHaveBeenCalled();
  });

  it("labels everything a screen reader can tap", () => {
    render(<DeleteAccountScreen />);
    expect(unlabelledTappables(screen.UNSAFE_root)).toEqual([]);
  });
});
