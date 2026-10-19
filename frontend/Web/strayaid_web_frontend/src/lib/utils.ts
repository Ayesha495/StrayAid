import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and lets later Tailwind classes win (used by the UI library components). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
