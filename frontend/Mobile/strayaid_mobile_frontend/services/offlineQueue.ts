import AsyncStorage from "@react-native-async-storage/async-storage";

import { appendFile } from "../utils/formFile";
import { API_BASE } from "./apiConfig";
import { submitReport } from "./mobileContentService";
import type { ReportDraft } from "./reportDraft";

// Reports that couldn't be sent because there was no connection (the "Local Storage Queue"
// on the connection-error screen). They stay on the phone and are sent when the app is back
// online. Rescue teams' phone numbers are kept too, so someone can still call one offline.

const QUEUE_KEY = "strayaid.reportQueue";
const CONTACTS_KEY = "strayaid.rescueContacts";

export type QueuedReport = {
  id: string;
  saved_at: string;
  draft: Pick<ReportDraft, "photo" | "location" | "address" | "description" | "keepUpdated">;
};

export type RescueContact = { id: number; name: string; phone: string; city: string; is_available: boolean; is_verified?: boolean };

// fetch() fails with a TypeError when there is no connection at all.
export function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /network|failed to fetch|timed? ?out/i.test(error.message));
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getQueue(): Promise<QueuedReport[]> {
  return read<QueuedReport[]>(QUEUE_KEY, []);
}

export async function queueReport(draft: QueuedReport["draft"]): Promise<QueuedReport> {
  const entry: QueuedReport = { id: `${Date.now()}`, saved_at: new Date().toISOString(), draft };
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, entry]));
  return entry;
}

async function remove(id: string) {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((entry) => entry.id !== id)));
}

// Is the StrayAid server reachable? Gives up after a few seconds.
export async function checkConnection(timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/api/posts/stories/`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let flushing: Promise<{ sent: number; left: number }> | null = null;

// Sends every queued report, oldest first. Reports that still can't go stay queued.
export function flushQueue(): Promise<{ sent: number; left: number }> {
  if (!flushing) {
    flushing = (async () => {
      let sent = 0;
      for (const entry of await getQueue()) {
        const { draft } = entry;
        if (!draft.photo || !draft.location) {
          await remove(entry.id);
          continue;
        }
        try {
          const form = new FormData();
          form.append("description", draft.description);
          form.append("latitude", draft.location.latitude.toString());
          form.append("longitude", draft.location.longitude.toString());
          form.append("keep_updated", draft.keepUpdated ? "true" : "false");
          if (draft.address) form.append("area", draft.address);
          await appendFile(form, "image", draft.photo);
          await submitReport(form);
          await remove(entry.id);
          sent += 1;
        } catch (error) {
          // Offline again (or signed out): try the rest next time. A refused report is dropped.
          if (isNetworkError(error) || (error instanceof Error && /sign in/i.test(error.message))) break;
          await remove(entry.id);
        }
      }
      return { sent, left: (await getQueue()).length };
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

export async function saveRescueContacts(contacts: RescueContact[]) {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.filter((contact) => contact.phone))).catch(() => null);
}

export async function getRescueContacts(): Promise<RescueContact[]> {
  return read<RescueContact[]>(CONTACTS_KEY, []);
}
