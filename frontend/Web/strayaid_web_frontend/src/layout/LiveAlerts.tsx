import { useEffect, useRef } from "react";
import { getNearbyCases } from "../services/platformService";
import { getNotifications } from "../services/notificationService";
import { usePolling } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import { useShell } from "./ShellContext";
import { caseTitle } from "../utils/cases";
import { formatKm } from "../utils/format";
import { notificationLink } from "../utils/notifications";

// How often an organization's browser checks for new unclaimed cases nearby.
const NEARBY_POLL_MS = 60_000;

// Notification types that pop up as a toast for organizations. New cases come from the
// nearby poll instead, so critical-case notifications aren't toasted twice.
const ORG_TOAST_TYPES = new Set(["adoption_application", "application", "sponsorship", "sponsor", "shelter_donation", "chat_message"]);

const stripMarkup = (text: string) => text.replace(/\*\*/g, "");

/**
 * Pops up a toast when something new needs attention while the site is open:
 * new nearby cases and applications/receipts for organizations, any notification for
 * reporters. The first check only records what already exists, so nothing old pops up.
 */
function LiveAlerts() {
  const toast = useToast();
  const { user, isOrganization, unread } = useShell();
  const seenCases = useRef<Set<number> | null>(null);
  const seenNotifications = useRef<Set<number> | null>(null);
  const lastUnread = useRef<number | null>(null);

  const checkNearby = () => {
    if (!isOrganization) return;
    getNearbyCases()
      .then((cases) => {
        const known = seenCases.current;
        seenCases.current = new Set(cases.map((item) => item.id));
        if (!known) return;
        cases
          .filter((item) => !known.has(item.id))
          .slice(0, 3)
          .forEach((item) => {
            const urgent = (item.confidence_score ?? 0) >= 70 || item.severity === "critical" || item.severity === "high";
            toast({
              title: urgent ? "Urgent case nearby" : "New case nearby",
              body: [caseTitle(item), formatKm(item.distance_km), item.confidence_score !== null && item.confidence_score !== undefined ? `${item.confidence_score}% priority` : ""]
                .filter(Boolean)
                .join(" · "),
              tone: urgent ? "urgent" : "default",
              link: { to: `/cases/${item.id}`, label: "Review case" },
            });
          });
      })
      .catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(checkNearby, [isOrganization]);
  usePolling(checkNearby, NEARBY_POLL_MS, isOrganization);

  // When the unread count goes up, toast the notifications we haven't seen.
  useEffect(() => {
    if (!user) return;
    const previous = lastUnread.current;
    lastUnread.current = unread.notifications;
    if (previous !== null && unread.notifications <= previous && seenNotifications.current) return;
    getNotifications(true)
      .then((items) => {
        const known = seenNotifications.current;
        seenNotifications.current = new Set([...(known ?? []), ...items.map((item) => item.id)]);
        if (!known) return;
        items
          .filter((item) => !known.has(item.id))
          .filter((item) => !isOrganization || ORG_TOAST_TYPES.has(String(item.data?.type)))
          .slice(0, 3)
          .forEach((item) => {
            const link = notificationLink(item, isOrganization);
            toast({ title: item.title, body: stripMarkup(item.body), link: link ? { to: link, label: "Open" } : undefined });
          });
      })
      .catch(() => {});
  }, [user, isOrganization, unread.notifications, toast]);

  return null;
}

export default LiveAlerts;
