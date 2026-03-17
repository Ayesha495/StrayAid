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

export interface TokenResponse {
    access: string;
    refresh: string;
}