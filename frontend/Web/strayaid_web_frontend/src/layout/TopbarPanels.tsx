import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, MessageSquare } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { getInbox } from "../services/chatService";
import { useShell } from "./ShellContext";
import Avatar from "../ui/Avatar";
import RichText from "../ui/RichText";
import { Spinner } from "../ui/States";
import { formatRelativeTime } from "../utils/time";
import { notificationLink } from "../utils/notifications";
import type { AppNotification, ConversationSummary } from "../types/api";
import { NotificationIcon } from "../components/NotificationIcon";
import "./TopbarPanels.css";

function CountDot({ count }: { count: number }) {
  if (!count) return null;
  return <span className="count-dot">{count > 99 ? "99+" : count}</span>;
}

/** An icon button in the top bar that opens a dropdown panel. */
function PanelButton({ label, icon, count, buttonClassName, children }: { label: string; icon: ReactNode; count: number; buttonClassName: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="panel-anchor" ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={`${label}${count ? `, ${count} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <CountDot count={count} />
      </button>
      {open ? <div className="ds dropdown panel" role="dialog" aria-label={label}>{children(() => setOpen(false))}</div> : null}
    </div>
  );
}

function NotificationList({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const { isOrganization, refreshUnread } = useShell();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    getNotifications().then((data) => setItems(data.slice(0, 8))).catch(() => setItems([]));
  }, []);

  const open = (item: AppNotification) => {
    if (item.unread) markNotificationRead(item.id).then(refreshUnread).catch(() => {});
    const link = notificationLink(item, isOrganization);
    close();
    if (link) navigate(link);
  };

  const readAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setItems((current) => current?.map((item) => ({ ...item, unread: false })) ?? null);
    refreshUnread();
  };

  return (
    <>
      <div className="panel-head">
        <strong>Notifications</strong>
        <button type="button" className="link small panel-link-btn" onClick={readAll}>Mark all read</button>
      </div>
      <div className="panel-body">
        {items === null ? (
          <div className="panel-empty"><Spinner /></div>
        ) : items.length ? (
          <ul className="panel-list">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className={`panel-item${item.unread ? " is-unread" : ""}`} onClick={() => open(item)}>
                  <NotificationIcon kind={item.kind} />
                  <span className="panel-item-text">
                    <span className="small"><RichText text={item.body} /></span>
                    <span className="small muted">{formatRelativeTime(item.created_at)}</span>
                  </span>
                  {item.unread ? <span className="panel-dot" aria-label="Unread" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-empty small muted">You're all caught up.</div>
        )}
      </div>
      <Link to="/notifications" className="panel-foot" onClick={close}>See all notifications</Link>
    </>
  );
}

function ConversationList({ close }: { close: () => void }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    getInbox().then((data) => setItems(data.results.slice(0, 6))).catch(() => setItems([]));
  }, []);

  return (
    <>
      <div className="panel-head"><strong>Messages</strong></div>
      <div className="panel-body">
        {items === null ? (
          <div className="panel-empty"><Spinner /></div>
        ) : items.length ? (
          <ul className="panel-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/messages/${item.id}`} className={`panel-item${item.unread_count ? " is-unread" : ""}`} onClick={close}>
                  <Avatar name={item.title} src={item.avatar} size={34} square={item.is_organization} />
                  <span className="panel-item-text">
                    <span className="strong small truncate">{item.title}</span>
                    <span className="small muted truncate">
                      {item.last_message ? `${item.last_message.from_me ? "You: " : ""}${item.last_message.body || "📷 Photo"}` : "No messages yet"}
                    </span>
                  </span>
                  {item.unread_count ? <span className="panel-count">{item.unread_count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-empty small muted">No conversations yet.</div>
        )}
      </div>
      <Link to="/messages" className="panel-foot" onClick={close}>Open messages</Link>
    </>
  );
}

type PanelProps = { buttonClassName?: string };

export function MessagesPanel({ buttonClassName = "sa-icon-btn" }: PanelProps) {
  const { unread } = useShell();
  return (
    <PanelButton label="Messages" icon={<MessageSquare size={18} />} count={unread.messages} buttonClassName={buttonClassName}>
      {(close) => <ConversationList close={close} />}
    </PanelButton>
  );
}

export function NotificationsPanel({ buttonClassName = "sa-icon-btn" }: PanelProps) {
  const { unread } = useShell();
  return (
    <PanelButton label="Notifications" icon={<Bell size={18} />} count={unread.notifications} buttonClassName={buttonClassName}>
      {(close) => <NotificationList close={close} />}
    </PanelButton>
  );
}
