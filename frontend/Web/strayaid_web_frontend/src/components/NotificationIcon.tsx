import { Activity, AlertTriangle, Bell, HandCoins, HeartHandshake, MessageSquare, Truck } from "lucide-react";
import type { NotificationKind } from "../types/api";
import "./NotificationIcon.css";

const ICONS: Record<NotificationKind, typeof Bell> = {
  rescue: Truck,
  alert: AlertTriangle,
  adoption: HeartHandshake,
  sponsorship: HandCoins,
  chat: MessageSquare,
  community: Activity,
};

/** A small tinted tile with the icon for a notification kind. */
export function NotificationIcon({ kind }: { kind: NotificationKind }) {
  const Icon = ICONS[kind] ?? Bell;
  return (
    <span className={`notification-icon kind-${kind}`} aria-hidden="true">
      <Icon size={15} />
    </span>
  );
}
