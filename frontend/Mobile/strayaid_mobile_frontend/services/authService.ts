import { LoginData, SignUpData, TokenResponse } from "../types/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { API_BASE } from "./apiConfig";
import { appendFile } from "../utils/formFile";
import { clearToken, saveToken } from "../utils/tokenStorage";
import { registerForPushNotifications, sendPushTokenToBackend } from "./notificationService";

const NETWORK_ERROR = "Can't reach StrayAid right now. Check your connection and try again.";

// fetch + JSON that turns a dropped connection into a readable message.
const postJson = async (path: string, body: object) => {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        throw new Error(NETWORK_ERROR);
    }
    const result = await res.json().catch(() => ({}));
    return { res, result };
};

// Push tokens can only be saved for a signed-in user, so register right after sign-in.
const registerPushAfterSignIn = () => {
    registerForPushNotifications()
        .then((token) => (token ? sendPushTokenToBackend(token) : undefined))
        .catch(() => null);
};

const persistSession = async (result: TokenResponse, email?: string) => {
    // AsyncStorage supports app flows while SecureStore keeps a durable access token copy.
    await AsyncStorage.setItem('access_token', result.access);
    await AsyncStorage.setItem('refresh_token', result.refresh);
    await saveToken(result.access);

    const sessionEmail = result.user?.email || email;
    if (sessionEmail) {
        await AsyncStorage.setItem('user_email', sessionEmail);
    }
    registerPushAfterSignIn();
};

// Errors from sign-up, keyed by form field so the screen can mark the right input.
export class SignUpError extends Error {
    fields: Partial<Record<'fullName' | 'email' | 'password' | 'avatar', string>>;

    constructor(message: string, fields: SignUpError['fields'] = {}) {
        super(message);
        this.fields = fields;
    }
}

const firstMessage = (value: unknown) => (Array.isArray(value) ? String(value[0]) : value ? String(value) : undefined);

export const registerUser = async (data: SignUpData) => {
    // Multipart so the optional profile photo travels with the account details.
    const form = new FormData();
    form.append('full_name', data.fullName.trim());
    form.append('email', data.email.trim());
    form.append('password', data.password);
    form.append('re_password', data.rePassword);
    if (data.avatar) {
        await appendFile(form, 'avatar', data.avatar);
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE}/auth/users/`, { method: 'POST', body: form });
    } catch {
        throw new SignUpError(NETWORK_ERROR);
    }
    const result = await res.json().catch(() => ({}));
    if (res.ok) return result as { id: number; email: string };

    const fields: SignUpError['fields'] = {
        fullName: firstMessage(result.full_name),
        email: firstMessage(result.email),
        password: firstMessage(result.password) || firstMessage(result.re_password),
        avatar: firstMessage(result.avatar),
    };
    const message =
        fields.email || fields.password || fields.fullName || fields.avatar ||
        firstMessage(result.non_field_errors) || firstMessage(result.detail) ||
        "We couldn't create your account. Please try again.";
    throw new SignUpError(message, fields);
};

export const loginUser = async (data: LoginData): Promise<TokenResponse> => {
    const { res, result } = await postJson('/auth/jwt/create/', { ...data, email: data.email.trim() });
    if (res.ok) {
        await persistSession(result, data.email.trim());
        return result;
    }
    // simplejwt answers 401 "No active account found..." for a wrong email or password.
    throw new Error(res.status === 401 ? "That email and password don't match. Try again." : result.detail || 'Sign in failed. Please try again.');
};

export const requestPasswordReset = async (email: string): Promise<string> => {
    const { res, result } = await postJson('/auth/password-reset/', { email: email.trim() });
    if (!res.ok) throw new Error(result.detail || "We couldn't send a code. Please try again.");
    return result.detail;
};

export const confirmPasswordReset = async (email: string, code: string, newPassword: string): Promise<string> => {
    const { res, result } = await postJson('/auth/password-reset/confirm/', {
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
    });
    if (!res.ok) throw new Error(result.detail || "We couldn't reset your password. Please try again.");
    return result.detail;
};

export const loginWithGoogleAccessToken = async (accessToken: string): Promise<TokenResponse> => {
    // The backend finishes Google verification and returns our normal JWT payload.
    const res = await fetch(`${API_BASE}/auth/google/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
    });
    const result = await res.json();
    if (res.ok) {
        await persistSession(result);
        return result;
    }
    throw new Error(result.detail || 'Google login failed');
};

export const logoutUser = async () => {
    // Clear all stored credentials before redirecting to the auth stack.
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user_email');
    await clearToken();
    router.replace("/(auth)/login/page");
};
