export interface LoginData {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    username:string;
    password: string;
    re_password: string;
}

export interface CurrentUser {
    id: number;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    role: "public" | "organization" | "admin";
}

export interface TokenResponse {
    access: string;
    refresh: string;
    user?: CurrentUser;
}
