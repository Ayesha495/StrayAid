// EXPO_PUBLIC_API_URL is written to .env by update-ip.js (runs automatically via
// `npm start`/`android`/`ios`), which auto-detects this machine's LAN IP. Only
// EXPO_PUBLIC_-prefixed vars are inlined into the Expo Go bundle at build time.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
