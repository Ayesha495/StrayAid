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

  // androidClientId requires the SHA-1 of your EAS keystore registered in
  // Google Cloud Console under the Android OAuth 2.0 client.
  // Run: eas credentials --platform android  to get your SHA-1.
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "998658289609-u4an6pas5lcpg578tb3c1rhdre8g5eji.apps.googleusercontent.com",
    iosClientId: "998658289609-1g2mm1bre24hlccle05gmon0c416h44v.apps.googleusercontent.com",
    clientId: "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com",
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
