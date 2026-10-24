import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";

import { loginWithGoogleAccessToken } from "./authService";

WebBrowser.maybeCompleteAuthSession();

type UseGoogleAuthOptions = {
  onSuccess?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

export function useGoogleAuth(options: UseGoogleAuthOptions = {}) {
  // Keep callbacks in refs so the effect dep array only changes on `response`
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
  });

  // OAuth client IDs are public, but they differ per environment, so they come from .env.
  // The Android client needs the SHA-1 of the EAS keystore (eas credentials --platform android).
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    const completeGoogleAuth = async () => {
      if (response?.type !== "success") {
        if (response?.type === "error") {
          onErrorRef.current?.("Google login failed.");
        }
        return;
      }

      const token = response.authentication?.accessToken;
      if (!token) {
        onErrorRef.current?.("Google login failed.");
        return;
      }

      try {
        await loginWithGoogleAccessToken(token);
        await onSuccessRef.current?.();
      } catch (error) {
        onErrorRef.current?.(error instanceof Error ? error.message : "Google login failed.");
      }
    };

    completeGoogleAuth();
  }, [response]);

  return { request, promptAsync };
}
