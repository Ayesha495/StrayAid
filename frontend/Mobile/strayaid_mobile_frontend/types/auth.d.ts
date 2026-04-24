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

export type CurrentUser = {
    id: number;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    role: string;
};

export type TokenResponse = {
    access: string;
    refresh: string;
    user?: CurrentUser;
};
