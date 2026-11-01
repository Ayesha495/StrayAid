import { act, renderHook } from "@testing-library/react-native";

import { loginWithGoogleIdToken } from "../services/authService";
import { useGoogleAuth } from "../services/googleAuthService";

const mockSignIn = jest.fn();

jest.mock("../services/authService", () => ({ loginWithGoogleIdToken: jest.fn(async () => ({})) }));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signOut: jest.fn(async () => null),
    signIn: () => mockSignIn(),
  },
  isSuccessResponse: (response: { type: string }) => response.type === "success",
  isErrorWithCode: (error: { code?: string }) => !!error?.code,
  statusCodes: { IN_PROGRESS: "IN_PROGRESS", PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE" },
}));

async function prompt() {
  const onSuccess = jest.fn();
  const onError = jest.fn();
  const { result } = renderHook(() => useGoogleAuth({ onSuccess, onError }));
  let outcome;
  await act(async () => {
    outcome = await result.current.promptAsync();
  });
  return { outcome, onSuccess, onError };
}

describe("Google sign-in", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends Google's ID token to the backend and finishes signing in", async () => {
    mockSignIn.mockResolvedValue({ type: "success", data: { idToken: "google-id-token" } });
    const { outcome, onSuccess, onError } = await prompt();
    expect(loginWithGoogleIdToken).toHaveBeenCalledWith("google-id-token");
    expect(onSuccess).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(outcome).toEqual({ type: "success" });
  });

  it("does nothing when the person backs out of the account picker", async () => {
    mockSignIn.mockResolvedValue({ type: "cancelled", data: null });
    const { outcome, onError } = await prompt();
    expect(outcome).toEqual({ type: "cancel" });
    expect(onError).not.toHaveBeenCalled();
    expect(loginWithGoogleIdToken).not.toHaveBeenCalled();
  });

  it("shows Google's error code, so a setup problem can be told apart", async () => {
    mockSignIn.mockRejectedValue({ code: "10", message: "DEVELOPER_ERROR" });
    const { outcome, onError } = await prompt();
    expect(outcome).toEqual({ type: "error" });
    expect(onError).toHaveBeenCalledWith("Google login failed (code 10).");
  });

  it("shows why the backend refused the sign-in", async () => {
    mockSignIn.mockResolvedValue({ type: "success", data: { idToken: "google-id-token" } });
    (loginWithGoogleIdToken as jest.Mock).mockRejectedValueOnce(new Error("This account has been deleted."));
    const { onError, onSuccess } = await prompt();
    expect(onError).toHaveBeenCalledWith("This account has been deleted.");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
