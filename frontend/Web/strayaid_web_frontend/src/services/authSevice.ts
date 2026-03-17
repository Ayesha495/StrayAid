import API from "../api/axios";
import type { LoginData, RegisterData, TokenResponse } from "../types/authTypes";

export const register = async (data: RegisterData) => {
  return API.post("/auth/users/", data);
};

export const login = async (data: LoginData) => {
  const response = await API.post<TokenResponse>("/auth/jwt/create/", data);
  return response.data;
};