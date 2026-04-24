import { RegisterData, LoginData, TokenResponse } from "../types/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store'
import { router } from "expo-router";
const API_BASE = process.env.IP || 'http://192.168.1.13:8000';

const persistSession = async (result: TokenResponse, email?: string) => {
    // AsyncStorage supports app flows while SecureStore keeps a durable access token copy.
    await AsyncStorage.setItem('access_token', result.access);
    await AsyncStorage.setItem('refresh_token', result.refresh);
    await SecureStore.setItemAsync("access", result.access);

    const sessionEmail = result.user?.email || email;
    if (sessionEmail) {
        await AsyncStorage.setItem('user_email', sessionEmail);
    }
};

export const registerUser = async (data: RegisterData) => {
    const res = await fetch(`${API_BASE}/auth/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const loginUser = async (data: LoginData): Promise<TokenResponse> => {
    const res = await fetch(`${API_BASE}/auth/jwt/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if(res.ok) {
        await persistSession(result, data.email);
        return result;
    } else {
        throw new Error(result.detail || 'Login failed');
    }
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
    await SecureStore.deleteItemAsync("access");
    router.replace("/(auth)/login/page");
};
