// Build-time settings from the environment (see .env.example).
// Tests swap this file for src/test/appConfig.ts, because Jest can't read import.meta.
export const API_ORIGIN: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL ?? "";
