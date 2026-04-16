import axios from "axios";

const API = axios.create({
    baseURL: "http://127.0.0.1:8000"
});

export const PublicAPI = axios.create({
    baseURL: "http://127.0.0.1:8000"
});

const AuthAPI = axios.create({
    baseURL: "http://127.0.0.1:8000"
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async () => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) {
        return null;
    }

    if (!refreshPromise) {
        refreshPromise = AuthAPI.post<{ access: string }>("/auth/jwt/refresh/", { refresh })
            .then((response) => {
                localStorage.setItem("access", response.data.access);
                return response.data.access;
            })
            .catch(() => {
                localStorage.removeItem("access");
                localStorage.removeItem("refresh");
                localStorage.removeItem("currentUser");
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

API.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isTokenExpired =
            error.response?.status === 401 &&
            error.response?.data?.code === "token_not_valid";

        if (!isTokenExpired || originalRequest?._retry) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;
        const newAccessToken = await refreshAccessToken();

        if (!newAccessToken) {
            return Promise.reject(error);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return API(originalRequest);
    }
);

export default API;
