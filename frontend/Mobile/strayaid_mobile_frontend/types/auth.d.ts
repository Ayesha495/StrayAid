export type RegisterData = {
    username: string;
    email: string;
    password:string;
    re_password: string;
};

export type LoginData = {
    email: string;
    password: string;
};

export type TokenResponse = {
    access: string;
    refresh: string;
};