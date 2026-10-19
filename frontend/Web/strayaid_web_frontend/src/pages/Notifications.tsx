import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Bell, CheckCheck, Circle, HandCoins, HeartHandshake, Inbox, Trash2, Truck } from "lucide-react";
import { clearReadNotifications, getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import RichText from "../ui/RichText";
import { EmptyState, ErrorState, LoadingRows } from "../ui/States";
import { NotificationIcon } from "../components/NotificationIcon";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import { notificationLink } from "../utils/notifications";
import type { AppNotification } from "../types/api";
import "./Notifications.css";

const KIND_FILTERS = [
  { key: "", label: "All", icon: Inbox, tone: "navy" },
  { key: "unread", label: "Unread", icon: Circle, tone: "green" },
  { key: "rescue", label: "Rescues", icon: Truck, tone: "amber" },
  { key: "adoption", label: "Adoptions", icon: HeartHandshake, tone: "purple" },
  { key: "sponsorship", label: "Funds", icon: HandCoins, tone: "gold" },
  { key: "community", label: "Community", icon: Activity, tone: "blue" },
];

const matches = (item: AppNotification, key: string) => {
  if (key === "unread") return item.unread;
  if (key === "rescue") return item.kind === "rescue" || item.kind === "alert";
  return !key || item.kind === key;
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isOrganization, refreshUnread } = useShell();
  const notifications = useApi(() => getNotifications());
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => (notifications.data ?? []).filter((item) => matches(item, filter)), [notifications.data, filter]);

  const groups = [
    { label: "Today", items: visible.filter((item) => isToday(item.created_at)) },
    { label: "Earlier", items: visible.filter((item) => !isToday(item.created_at)) },
  ].filter((group) => group.items.length);

  const unreadCount = (notifications.data ?? []).filter((item) => item.unread).length;
  const readCount = (notifications.data ?? []).length - unreadCount;

  const open = (item: AppNotification) => {
    if (item.unread) {
      notifications.setData((current = []) => current.map((row) => (row.id === item.id ? { ...row, unread: false } : row)));
      markNotificationRead(item.id).then(refreshUnread).catch(() => {});
    }
    const link = notificationLink(item, isOrganization);
    if (link) navigate(link);
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      notifications.setData((current = []) => current.map((row) => ({ ...row, unread: false })));
      refreshUnread();
    } catch (error) {
      toast({ title: "Couldn't mark them read", body: errorMessage(error), tone: "error" });
    }
  };

  const clearRead = async () => {
    try {
      await clearReadNotifications();
      notifications.setData((current = []) => current.filter((row) => row.unread));
      toast({ title: "Cleared read notifications" });
    } catch (error) {
      toast({ title: "Couldn't clear them", body: errorMessage(error), tone: "error" });
    }
  };

  return (
    <div className="page notifications-page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>{unreadCount ? `${unreadCount} unread` : "You're all caught up."}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={readAll} disabled={!unreadCount}><CheckCheck size={16} /> Mark all read</button>
          <button type="button" className="btn btn-ghost" onClick={clearRead} disabled={!readCount}><Trash2 size={16} /> Clear read</button>
        </div>
      </div>

      <div className="notif-layout">
      {/* A category rail, like an email inbox: counts per kind, each in its colour. */}
      <nav className="card notif-rail" aria-label="Notification type">
        {KIND_FILTERS.map((entry) => {
          const count = (notifications.data ?? []).filter((item) => matches(item, entry.key)).length;
          return (
            <button key={entry.key} type="button" className={`notif-rail-item tone-${entry.tone}`} aria-pressed={filter === entry.key} onClick={() => setFilter(entry.key)}>
              <span className="notif-rail-icon"><entry.icon size={15} /></span>
              <span className="notif-rail-label">{entry.label}</span>
              <span className="notif-rail-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <section className="card notif-feed">
        {notifications.loading && !notifications.data ? (
          <div className="card-body"><LoadingRows rows={6} height={52} /></div>
        ) : notifications.error && !notifications.data ? (
          <ErrorState message={errorMessage(notifications.error)} onRetry={notifications.reload} />
        ) : groups.length ? (
          groups.map((group) => (
            <div key={group.label}>
              <h2 className="notif-group">{group.label}</h2>
              <ul className="notif-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`notif-row${item.unread ? " is-unread" : ""}`} onClick={() => open(item)}>
                      <NotificationIcon kind={item.kind} />
                      <span className="notif-text">
                        <span className="small muted">{item.title}</span>
                        <span><RichText text={item.body} /></span>
                      </span>
                      <span className="small muted notif-time">{formatRelativeTime(item.created_at)}</span>
                      {item.unread ? <span className="panel-dot" aria-label="Unread" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <EmptyState icon={<Bell size={22} />} title="Nothing here" message="Rescue updates, applications, receipts and replies will show up here." />
        )}
      </section>
      </div>
    </div>
  );
}

export default Notifications;
