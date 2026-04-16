import API from "../api/axios";
import { useMemo, useSyncExternalStore } from "react";
import type { CurrentUser, LoginData, RegisterData, TokenResponse } from "../types/authTypes";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com";

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

export const login = async (data: LoginData) => {
  const response = await API.post<TokenResponse>("/auth/jwt/create/", data);
  return response.data;
};

export const loginWithGoogle = async () => {
  await loadGoogleScript();

  return new Promise<TokenResponse>((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (googleResponse) => {
        if (!googleResponse.access_token) {
          reject(new Error(googleResponse.error || "Google login failed."));
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
    });

    if (!tokenClient) {
      reject(new Error("Google login is unavailable."));
      return;
    }

    tokenClient.requestAccessToken();
  });
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

const ORGANIZATION_ROUTES = [
  "/dashboard",
  "/cases",
  "/animals",
  "/organization/register",
];

export const resolvePostLoginRoute = (user: CurrentUser | null, from?: string) => {
  if (!from) {
    return getDefaultAuthenticatedRoute(user);
  }

  if (user?.role === "organization") {
    return ORGANIZATION_ROUTES.some((route) => from.startsWith(route))
      ? from
      : "/dashboard";
  }

  return from === "/feed" || from.startsWith("/animals/")
    ? from
    : "/feed";
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
