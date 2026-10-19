import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, MessageSquare, Phone, Search, Send, X } from "lucide-react";
import { getConversation, getInbox, getMessages, sendMessage } from "../services/chatService";
import { useApi, usePolling } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import { EmptyState, ErrorState, LoadingRows } from "../ui/States";
import { formatRelativeTime } from "../utils/time";
import { formatDuration } from "../utils/format";
import { errorMessage } from "../utils/errors";
import type { ChatMessage, ConversationSummary } from "../types/api";
import "./Messages.css";

// Polling intervals (the backend has no websockets): an open thread and the inbox.
const THREAD_POLL_MS = 5_000;
const INBOX_POLL_MS = 30_000;

const FILTERS = [
  { key: "", label: "All" },
  { key: "rescues", label: "Rescues" },
  { key: "adoptions", label: "Adoptions" },
  { key: "shelters", label: "General" },
];

// Conversation tags use the app-wide meanings: amber = a rescue case, purple = adoption, coral = urgent.
const TAG_TONE: Record<string, string> = { amber: "chip-amber", green: "chip-green", red: "chip-coral", coral: "chip-coral" };
const tagClass = (tag: { label: string; tone: string }) => (/adoption/i.test(tag.label) ? "chip-purple" : TAG_TONE[tag.tone] ?? "chip-outline");

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function InboxRow({ conversation, active }: { conversation: ConversationSummary; active: boolean }) {
  const last = conversation.last_message;
  return (
    <li>
      <Link to={`/messages/${conversation.id}`} className={`inbox-row${active ? " is-active" : ""}${conversation.unread_count ? " is-unread" : ""}`}>
        <Avatar name={conversation.title} src={conversation.avatar} size={40} square={conversation.is_organization} />
        <span className="inbox-row-main">
          <span className="inbox-row-top">
            <span className="inbox-row-title truncate">{conversation.title}</span>
            <span className="small muted">{formatRelativeTime(conversation.last_message_at)}</span>
          </span>
          {conversation.tag ? <span className={`chip ${tagClass(conversation.tag)}`}>{conversation.tag.label}</span> : null}
          <span className="inbox-row-preview truncate">
            {last ? `${last.from_me ? "You: " : ""}${last.body || (last.has_image ? "📷 Photo" : "")}` : "No messages yet"}
          </span>
        </span>
        {conversation.unread_count ? <span className="inbox-unread">{conversation.unread_count}</span> : null}
      </Link>
    </li>
  );
}

function Thread({ conversationId }: { conversationId: string }) {
  const toast = useToast();
  const { isOrganization, refreshUnread } = useShell();
  const conversation = useApi(() => getConversation(conversationId), conversationId);
  const thread = useApi(() => getMessages(conversationId), conversationId);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useMemo(() => thread.data ?? [], [thread.data]);
  const lastId = messages.at(-1)?.id;

  // Opening the thread marks it read on the server; refresh the topbar badge.
  useEffect(() => {
    if (thread.data) refreshUnread();
  }, [thread.data, refreshUnread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  usePolling(() => {
    getMessages(conversationId, lastId)
      .then((fresh) => {
        if (fresh.length) thread.setData((current = []) => [...current, ...fresh.filter((message) => !current.some((known) => known.id === message.id))]);
      })
      .catch(() => {});
  }, THREAD_POLL_MS, Boolean(thread.data));

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = body.trim();
    if (!text && !image) return;
    setSending(true);
    try {
      const sent = await sendMessage(conversationId, text, image);
      thread.setData((current = []) => [...current, sent]);
      setBody("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      toast({ title: "Message not sent", body: errorMessage(error), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const detail = conversation.data;
  const contextLink = detail?.case
    ? { to: isOrganization ? `/cases/${detail.case.id}` : `/case/${detail.case.id}`, label: `${detail.case.reference} · ${detail.case.status_label}` }
    : detail?.animal
      ? { to: `/animals/${detail.animal.id}`, label: detail.animal.name }
      : null;

  if (conversation.error && !detail) {
    return <ErrorState title="Conversation not found" message={errorMessage(conversation.error)} onRetry={conversation.reload} />;
  }

  return (
    <div className="thread">
      <header className="thread-head">
        <Link to="/messages" className="sa-icon-btn thread-back" aria-label="Back to inbox"><ArrowLeft size={18} /></Link>
        {detail ? (
          <>
            <Avatar name={detail.title} src={detail.avatar} size={38} square={detail.is_organization} />
            <div className="thread-head-text">
              <span className="strong truncate">{detail.title}</span>
              {contextLink ? <Link to={contextLink.to} className="small link truncate">{contextLink.label}</Link> : <span className="small muted">General message</span>}
            </div>
            {detail.phone ? (
              <a href={`tel:${detail.phone}`} className="btn btn-secondary btn-sm"><Phone size={14} /> Call</a>
            ) : null}
          </>
        ) : (
          <span className="muted">Loading…</span>
        )}
      </header>

      <div className="thread-body" aria-live="polite">
        {thread.loading && !thread.data ? (
          <LoadingRows rows={4} height={44} />
        ) : messages.length ? (
          messages.map((message: ChatMessage, index) => {
            const newDay = index === 0 || dayLabel(messages[index - 1].created_at) !== dayLabel(message.created_at);
            return (
              <div key={message.id}>
                {newDay ? <div className="thread-day"><span>{dayLabel(message.created_at)}</span></div> : null}
                <div className={`bubble-row${message.from_me ? " is-mine" : ""}`}>
                  <div className="bubble">
                    {!message.from_me ? <span className="bubble-name">{message.sender_name}</span> : null}
                    {message.image ? (
                      <a href={message.image} target="_blank" rel="noreferrer"><img src={message.image} alt="Shared photo" className="bubble-image" /></a>
                    ) : null}
                    {message.body ? <p>{message.body}</p> : null}
                    <span className="bubble-time">{timeLabel(message.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState icon={<MessageSquare size={22} />} title="Say hello" message="Messages you send appear here." />
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={send}>
        {image ? (
          <div className="composer-attachment">
            <span className="small truncate">📷 {image.name}</span>
            <button type="button" className="sa-icon-btn" aria-label="Remove photo" onClick={() => setImage(null)}><X size={14} /></button>
          </div>
        ) : null}
        <div className="composer-row">
          <button type="button" className="sa-icon-btn" aria-label="Attach a photo" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={19} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          <textarea
            className="textarea composer-input"
            rows={1}
            maxLength={2000}
            value={body}
            placeholder="Write a message…"
            aria-label="Message"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || (!body.trim() && !image)} aria-label="Send">
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { isOrganization } = useShell();
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const inbox = useApi(() => getInbox(filter), filter);
  usePolling(inbox.reload, INBOX_POLL_MS);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (inbox.data?.results ?? []).filter((row) =>
      !needle || [row.title, row.tag?.label, row.last_message?.body].some((field) => field?.toLowerCase().includes(needle)));
  }, [inbox.data, query]);

  // Reading a thread changes unread counts in the inbox.
  useEffect(() => {
    if (conversationId) inbox.reload();
    // Only when the open conversation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return (
    <div className="page messages-page">
      <div className={`messages${conversationId ? " has-thread" : ""}`}>
        <aside className="inbox" aria-label="Conversations">
          <div className="inbox-head">
            <h1>Messages</h1>
            <label className="input-with-icon">
              <Search size={16} />
              <input className="input" type="search" placeholder="Search people or cases" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search conversations" />
            </label>
            <div className="tabs inbox-tabs" role="group" aria-label="Conversation type">
              {FILTERS.map((entry) => (
                <button key={entry.key} type="button" className="tab" aria-selected={filter === entry.key} aria-pressed={filter === entry.key} onClick={() => setFilter(entry.key)}>
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          {inbox.loading && !inbox.data ? (
            <div style={{ padding: 16 }}><LoadingRows rows={4} height={60} /></div>
          ) : inbox.error && !inbox.data ? (
            <ErrorState message={errorMessage(inbox.error)} onRetry={inbox.reload} />
          ) : rows.length ? (
            <ul className="inbox-list">
              {rows.map((row) => <InboxRow key={row.id} conversation={row} active={String(row.id) === conversationId} />)}
            </ul>
          ) : (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="No conversations"
              message={isOrganization
                ? "Reporters and adopters can message you. You can also message a case's reporter from the case page."
                : "Message a rescue team from a case or an animal's page."}
            />
          )}
          {inbox.data?.response_minutes ? (
            <p className="inbox-foot small muted">Rescue teams usually reply within {formatDuration(inbox.data.response_minutes)}.</p>
          ) : null}
        </aside>

        <section className="thread-pane">
          {conversationId ? (
            <Thread key={conversationId} conversationId={conversationId} />
          ) : (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="Pick a conversation"
              message="Choose someone on the left to read and reply."
              action={rows[0] ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/messages/${rows[0].id}`)}>Open latest</button> : undefined}
            />
          )}
        </section>
      </div>
    </div>
  );
}

export default Messages;
