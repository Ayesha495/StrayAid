import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

import { loginWithGoogleAccessToken } from "./authService";

WebBrowser.maybeCompleteAuthSession();

type UseGoogleAuthOptions = {
  onSuccess?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

export function useGoogleAuth(options: UseGoogleAuthOptions = {}) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "998658289609-u4an6pas5lcpg578tb3c1rhdre8g5eji.apps.googleusercontent.com",
    iosClientId: "998658289609-1g2mm1bre24hlccle05gmon0c416h44v.apps.googleusercontent.com",
    clientId: "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com",
  });

  useEffect(() => {
    const completeGoogleAuth = async () => {
      if (response?.type !== "success") {
        if (response?.type === "error") {
          options.onError?.("Google login failed.");
        }
        return;
      }

      const token = response.authentication?.accessToken;
      if (!token) {
        options.onError?.("Google login failed.");
        return;
      }

      try {
        await loginWithGoogleAccessToken(token);
        await options.onSuccess?.();
      } catch (error) {
        options.onError?.(error instanceof Error ? error.message : "Google login failed.");
      }
    };

    completeGoogleAuth();
  }, [options, response]);

  return { request, promptAsync };
}
