import { isAxiosError } from "axios";

/** A readable message from a DRF error response ("detail", field errors or a list). */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (!error.response) return "Can't reach the StrayAid server. Check your connection.";
    if (typeof data === "string" && data.length < 200) return data;
    if (data && typeof data === "object") {
      if ("detail" in data && typeof data.detail === "string") return data.detail;
      const first = Object.entries(data as Record<string, unknown>)[0];
      if (first) {
        const [field, value] = first;
        const text = Array.isArray(value) ? String(value[0]) : String(value);
        return field === "non_field_errors" ? text : `${field.replace(/_/g, " ")}: ${text}`;
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
