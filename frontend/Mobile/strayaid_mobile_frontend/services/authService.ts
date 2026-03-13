import { RegisterData, LoginData, TokenResponse } from "../types/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store'
import { router } from "expo-router";
export const API_URL = 'http://192.168.1.21:8000';

export const registerUser = async (data: RegisterData) => {
    const res = await fetch(`${API_URL}/auth/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const loginUser = async (data: LoginData): Promise<TokenResponse> => {
    const res = await fetch(`${API_URL}/auth/jwt/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if(res.ok) {
        await AsyncStorage.setItem('access_token', result.access);
        await AsyncStorage.setItem('refresh_token', result.refresh);
        await SecureStore.setItemAsync("accessToken", result.access);
        return result;
    } else {
        throw new Error(result.detail || 'Login failed');
    }
};

export const logoutUser = async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await SecureStore.deleteItemAsync("accessToken");
    router.replace("/(auth)/login/page");
};