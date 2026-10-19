// Small formatting helpers shared by many screens.

export function displayNameOf(user: { first_name?: string; last_name?: string; username?: string; email?: string } | null | undefined) {
  if (!user) return "";
  const full = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return full || user.username || user.email?.split("@")[0] || "";
}

export function initialsOf(name?: string | null) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** The AI rescue priority score (0-100): higher means more urgent. */
export function scoreTone(score: number | null | undefined): "high" | "medium" | "low" | "none" {
  if (score === null || score === undefined) return "none";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const formatPkr = (amount: number | null | undefined) => `Rs ${Math.round(amount ?? 0).toLocaleString("en-PK")}`;

export const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

export const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

export const formatKm = (km: number | null | undefined) =>
  km === null || km === undefined ? "" : km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;

export const capitalize = (value: string | null | undefined) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

/** A duration in minutes as people say it: "45 min", "3 h", "2.6 days". */
export function formatDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, "") : Math.round(days)} ${days === 1 ? "day" : "days"}`;
}
