import { API_BASE } from "./apiConfig";
import { clearToken, getRefreshToken, getToken, saveRefreshToken, saveToken } from "../utils/tokenStorage";

// Signed-in requests. Access tokens expire after an hour; when the server rejects one, the
// refresh token is used once to get a new access token and the request is retried. If that
// fails too, the stored tokens are cleared and SessionExpiredError tells the screen to ask the
// person to sign in again.

export class SessionExpiredError extends Error {
  constructor() {
    super("Your sign-in has expired. Please sign in again to continue.");
  }
}

// Several requests can fail at once; they all wait for the same refresh.
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = await getRefreshToken();
      if (!refresh) return null;
      try {
        const response = await fetch(`${API_BASE}/auth/jwt/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        await saveToken(data.access);
        if (data.refresh) await saveRefreshToken(data.refresh);
        return data.access as string;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

const withAuth = (init: RequestInit, token: string): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
});

// fetch() for endpoints that need a signed-in user.
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new SessionExpiredError();

  const response = await fetch(`${API_BASE}${path}`, withAuth(init, token));
  if (response.status !== 401) return response;

  const fresh = await refreshAccessToken();
  if (!fresh) {
    await clearToken();
    throw new SessionExpiredError();
  }
  const retry = await fetch(`${API_BASE}${path}`, withAuth(init, fresh));
  if (retry.status === 401) {
    await clearToken();
    throw new SessionExpiredError();
  }
  return retry;
}

// fetch() for public endpoints that personalise for signed-in users (e.g. liked_by_me).
// A dead session falls back to a guest request instead of failing the screen.
export async function optionalAuthFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (await getToken()) {
    try {
      return await authFetch(path, init);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error;
    }
  }
  return fetch(`${API_BASE}${path}`, init);
}
