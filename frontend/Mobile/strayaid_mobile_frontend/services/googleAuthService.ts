import { useCallback, useEffect, useRef } from "react";

import { loginWithGoogleIdToken } from "./authService";

type UseGoogleAuthOptions = {
  onSuccess?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");
type GoogleAuthResult = { type: "success" | "cancel" | "error" };

// A native module, so it's missing from Expo Go and from APKs built before it was added.
function loadGoogleSignIn(): GoogleSignInModule | null {
  try {
    return require("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

function messageFor(error: unknown, google: GoogleSignInModule) {
  if (!google.isErrorWithCode(error)) return error instanceof Error ? error.message : "Google login failed.";
  if (error.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return "Google Play services isn't available on this phone.";
  if (error.code === google.statusCodes.IN_PROGRESS) return "Google sign-in is already open.";
  // The code says what went wrong: 10 means this APK's signature isn't on the Android client.
  return `Google login failed (code ${error.code}).`;
}

// Android's own account picker. The app sends the ID token it returns to the backend, which
// checks it was issued for StrayAid's web client (the audience set by webClientId).
export function useGoogleAuth(options: UseGoogleAuthOptions = {}) {
  // Keep callbacks in refs so promptAsync always calls the latest ones.
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
  });

  const promptAsync = useCallback(async (): Promise<GoogleAuthResult> => {
    const google = loadGoogleSignIn();
    if (!google) {
      onErrorRef.current?.("Update the app to continue with Google.");
      return { type: "error" };
    }
    try {
      google.GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
      await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Forget the last choice, so the account picker always opens.
      await google.GoogleSignin.signOut().catch(() => null);
      const response = await google.GoogleSignin.signIn();
      if (!google.isSuccessResponse(response)) return { type: "cancel" };
      if (!response.data.idToken) {
        onErrorRef.current?.("Google login failed.");
        return { type: "error" };
      }
      await loginWithGoogleIdToken(response.data.idToken);
      await onSuccessRef.current?.();
      return { type: "success" };
    } catch (error) {
      onErrorRef.current?.(messageFor(error, google));
      return { type: "error" };
    }
  }, []);

  return { request: true, promptAsync };
}
