import { CurrentUser, RegisterData, LoginData, TokenResponse } from "../types/auth";
import { router } from "expo-router";
import { clearSession, getToken, saveSession } from "../utils/tokenStorage";

const API_BASE = process.env.IP || "http://192.168.1.8:8000";

export const registerUser = async (data: RegisterData) => {
    const res = await fetch(`${API_BASE}/auth/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const loginUser = async (data: LoginData): Promise<TokenResponse> => {
    const res = await fetch(`${API_BASE}/auth/jwt/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
        const user = await getCurrentUser(result.access);
        await saveSession(result.access, result.refresh, JSON.stringify(user));
        return result;
    }
    throw new Error(result.detail || "Login failed");
};

export const logoutUser = async () => {
    await clearSession();
    router.replace("/login/index");
};

export const getCurrentUser = async (accessToken?: string): Promise<CurrentUser> => {
    const token = accessToken ?? await getToken();
    const response = await fetch(`${API_BASE}/auth/me/`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || "Could not load user.");
    }

    return result;
};

export const getMyReports = async () => {
    const token = await getToken();
    const response = await fetch(`${API_BASE}/api/cases/my-reports/`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || "Could not load reports.");
    }

    return result;
};

export const getPublicAnimals = async () => {
    const response = await fetch(`${API_BASE}/api/animals/public/`);
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || "Could not load animals.");
    }
    return result;
};

export const getPublicFeed = async () => {
    const response = await fetch(`${API_BASE}/api/posts/public-feed/`);
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || "Could not load feed.");
    }
    return result;
};
