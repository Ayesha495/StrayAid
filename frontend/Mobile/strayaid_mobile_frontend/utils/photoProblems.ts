import type { ComponentProps } from "react";
import type { MaterialIcons } from "@expo/vector-icons";

import { ApiError, PhotoCheckTimeout } from "../services/mobileContentService";
import { isNetworkError } from "../services/offlineQueue";

// Why a report photo couldn't be checked (or a report couldn't be sent), worded for the
// person with what to do next. Each problem says whether a different photo is needed
// ("photo") or the same one can simply be tried again ("retry").

export type PhotoProblemKind =
  | "not_an_animal"
  | "unusable_photo"
  | "checker_unavailable"
  | "no_connection"
  | "server_unreachable"
  | "too_slow"
  | "server_error";

export type PhotoProblem = {
  kind: PhotoProblemKind;
  title: string;
  message: string;
  steps: string[];
  icon: ComponentProps<typeof MaterialIcons>["name"];
  // "photo": the photo has to change. "retry": the same photo can be checked again.
  fix: "photo" | "retry";
};

const PROBLEMS: Record<PhotoProblemKind, Omit<PhotoProblem, "kind">> = {
  not_an_animal: {
    title: "No animal found in this photo",
    message: "Our photo check couldn't see an animal. Reports need a clear photo of the animal so rescuers know what to expect.",
    steps: [
      "Get closer so the animal fills most of the frame.",
      "Make sure it's in focus and not hidden behind objects.",
      "Use daylight or turn on the flash if it's dark.",
    ],
    icon: "hide-image",
    fix: "photo",
  },
  unusable_photo: {
    title: "We couldn't use this photo",
    message: "The file couldn't be opened as a photo.",
    steps: [
      "Take a new photo with the camera instead of choosing a file.",
      "If choosing from the gallery, pick a JPG or PNG photo.",
      "Screenshots, videos and very large files can't be used.",
    ],
    icon: "broken-image",
    fix: "photo",
  },
  checker_unavailable: {
    title: "Photo check is starting up",
    message: "Your internet is fine: the StrayAid photo checker isn't ready yet. Your photo and location are kept.",
    steps: ["Wait about a minute.", "Tap “Try again” to check the same photo."],
    icon: "hourglass-top",
    fix: "retry",
  },
  no_connection: {
    title: "Can't connect",
    message:
      "Your phone couldn't reach StrayAid, so the photo wasn't checked. This is usually the internet connection. Your photo and location are kept.",
    steps: [
      "Check that Wi-Fi or mobile data is on.",
      "Move somewhere with a better signal.",
      "Tap “Try again” once you're connected.",
    ],
    icon: "wifi-off",
    fix: "retry",
  },
  server_unreachable: {
    title: "StrayAid isn't responding",
    message: "Your phone is online, but the StrayAid server didn't answer. Your photo and location are kept.",
    steps: ["Wait a minute, then tap “Try again”.", "If it keeps happening, the service may be down for a short while."],
    icon: "cloud-off",
    fix: "retry",
  },
  too_slow: {
    title: "The check took too long",
    message: "Uploading the photo took longer than expected, usually because of a weak connection.",
    steps: ["Move somewhere with a stronger signal or switch to Wi-Fi.", "Tap “Try again”."],
    icon: "timer-off",
    fix: "retry",
  },
  server_error: {
    title: "Something went wrong on our side",
    message: "The photo couldn't be checked because of a problem with StrayAid, not your phone.",
    steps: ["Tap “Try again”.", "If it keeps failing, try again in a few minutes."],
    icon: "error-outline",
    fix: "retry",
  },
};

function problem(kind: PhotoProblemKind, message?: string): PhotoProblem {
  const base = PROBLEMS[kind];
  return { kind, ...base, message: message || base.message };
}

// Session expiry isn't a photo problem: callers handle SessionExpiredError themselves.
export function describePhotoProblem(error: unknown): PhotoProblem {
  if (error instanceof PhotoCheckTimeout) return problem("too_slow");
  if (error instanceof ApiError) {
    if (error.code === "not_an_animal") return problem("not_an_animal");
    if (error.code === "invalid_image" || error.code === "unreadable_image") {
      // The server says exactly what's wrong, e.g. "Choose a photo smaller than 10 MB."
      return problem("unusable_photo", error.message);
    }
    if (error.code === "detector_unavailable") return problem("checker_unavailable");
    if (error.status === 413) return problem("unusable_photo", "This photo is too large to upload.");
    // 502/504: the dev-server proxy or a gateway in front of the backend got no answer.
    if (error.status === 502 || error.status === 504) return problem("server_unreachable");
    if (error.status === 503) return problem("checker_unavailable");
    return problem("server_error");
  }
  if (isNetworkError(error)) return problem("no_connection");
  return problem("server_error");
}
