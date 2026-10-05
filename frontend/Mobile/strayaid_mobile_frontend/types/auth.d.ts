export type SignUpData = {
    fullName: string;
    email: string;
    password: string;
    rePassword: string;
    avatar?: { uri: string; name: string; type: string } | null;
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
    avatar?: string | null;
};

export type TokenResponse = {
    access: string;
    refresh: string;
    user?: CurrentUser;
};
