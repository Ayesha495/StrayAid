import API from "../api/axios";
import { GOOGLE_CLIENT_ID } from "../appConfig";
import { useMemo, useSyncExternalStore } from "react";
import type { CurrentUser, LoginData, RegisterData, TokenResponse } from "../types/authTypes";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let googleScriptPromise: Promise<void> | null = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GOOGLE_SCRIPT_SRC}"]`
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Google script.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google script."));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
};

export const register = async (data: RegisterData) => {
  return API.post("/auth/users/", data);
};

/** Email a 6-digit reset code (the reply is the same whether or not the email has an account). */
export const requestPasswordReset = async (email: string) => {
  const response = await API.post<{ detail: string }>("/auth/password-reset/", { email });
  return response.data.detail;
};

export const confirmPasswordReset = async (data: { email: string; code: string; new_password: string }) => {
  const response = await API.post<{ detail: string }>("/auth/password-reset/confirm/", data);
  return response.data.detail;
};

export const login = async (data: LoginData) => {
  const response = await API.post<TokenResponse>("/auth/jwt/create/", data);
  return response.data;
};

/** Load Google's script ahead of time, so the sign-in popup opens straight from the click
 * (browsers block popups that open after a slow network wait). */
export const preloadGoogle = () => {
  loadGoogleScript().catch(() => {
    // Retry on click; the error is shown then.
    googleScriptPromise = null;
  });
};

const GOOGLE_POPUP_ERRORS: Record<string, string> = {
  popup_closed: "The Google window was closed before signing in.",
  popup_failed_to_open: "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
};

export const loginWithGoogle = async () => {
  try {
    await loadGoogleScript();
  } catch {
    googleScriptPromise = null;
    throw new Error("Couldn't reach Google. Check your connection and try again.");
  }

  return new Promise<TokenResponse>((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (googleResponse) => {
        if (!googleResponse.access_token) {
          reject(new Error(googleResponse.error_description || googleResponse.error || "Google sign-in failed."));
          return;
        }

        try {
          const response = await API.post<TokenResponse>("/auth/google/", {
            access_token: googleResponse.access_token,
          });
          resolve(response.data);
        } catch (error) {
          reject(error);
        }
      },
      // Without this, closing or blocking the popup left the button doing nothing.
      error_callback: (error) => {
        reject(new Error(GOOGLE_POPUP_ERRORS[error.type] || "Google sign-in didn't finish. Please try again."));
      },
    });

    if (!tokenClient) {
      reject(new Error("Google sign-in is unavailable right now."));
      return;
    }

    tokenClient.requestAccessToken();
  });
};

/** Sign in with Google and store the session, returning the signed-in user. */
export const signInWithGoogle = async () => {
  const session = await loginWithGoogle();
  return syncCurrentUser(session);
};

/** A readable message from a failed login (bad password, Google problem, server down). */
export const authErrorMessage = (error: unknown, fallback = "Login failed. Please try again.") => {
  const response = (error as { response?: { status?: number; data?: { detail?: string; non_field_errors?: string[] } } })?.response;
  if (response) {
    const detail = response.data?.detail || response.data?.non_field_errors?.[0] || "";
    if (response.status === 401 || String(detail).toLowerCase().includes("no active account")) {
      return "The username/email or password is incorrect.";
    }
    return detail || fallback;
  }
  if ((error as { code?: string })?.code === "ERR_NETWORK") {
    return "Can't reach the StrayAid server. Please try again in a moment.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

const USER_STORAGE_KEY = "currentUser";
const AUTH_CHANGE_EVENT = "strayaid-auth-change";

const emitAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

export const storeSession = (session: TokenResponse, user: CurrentUser) => {
  localStorage.setItem("access", session.access);
  localStorage.setItem("refresh", session.refresh);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  emitAuthChange();
};

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as CurrentUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    emitAuthChange();
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem(USER_STORAGE_KEY);
  emitAuthChange();
};

export const getCurrentUser = async () => {
  const response = await API.get<CurrentUser>("/auth/me/");
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
  emitAuthChange();
  return response.data;
};

export const syncCurrentUser = async (session?: TokenResponse) => {
  if (session) {
    localStorage.setItem("access", session.access);
    localStorage.setItem("refresh", session.refresh);
  }
  const currentUser = session?.user ?? await getCurrentUser();
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
  emitAuthChange();
  return currentUser;
};

export const getDefaultAuthenticatedRoute = (user: CurrentUser | null) => (
  user?.role === "organization" ? "/dashboard" : "/feed"
);

// Pages only one kind of account can use; everything else is shared or public.
const ORGANIZATION_ONLY = ["/dashboard", "/cases", "/applications", "/funds"];
const REPORTER_ONLY = ["/my-reports", "/following", "/my-applications", "/organization/register"];

const startsWithAny = (path: string, prefixes: string[]) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** Where to go after logging in: back to where you were, if your account can use that page. */
export const resolvePostLoginRoute = (user: CurrentUser | null, from?: string) => {
  const home = getDefaultAuthenticatedRoute(user);
  if (!from || from === "/" || from === "/login" || from === "/register") return home;
  const isOrganization = user?.role === "organization";
  if (isOrganization && startsWithAny(from, REPORTER_ONLY)) return home;
  if (!isOrganization && (startsWithAny(from, ORGANIZATION_ONLY) || from === "/animals")) return home;
  return from;
};

const subscribeToAuth = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
};

const getStoredUserSnapshot = () => localStorage.getItem(USER_STORAGE_KEY) ?? "";

export const useCurrentUser = () => {
  const snapshot = useSyncExternalStore(
    subscribeToAuth,
    getStoredUserSnapshot,
    getStoredUserSnapshot,
  );

  return useMemo(() => {
    if (!snapshot) {
      return null;
    }

    try {
      return JSON.parse(snapshot) as CurrentUser;
    } catch {
      return null;
    }
  }, [snapshot]);
};
