// Build-time settings. Set VITE_API_URL to the hosted backend when deploying.
// (Tests swap this file for src/test/appConfig.ts, because Jest can't read import.meta.)
export const API_ORIGIN: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com";
