import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

type StateProps = {
  title: string;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, message, icon, action }: StateProps) {
  return (
    <div className="state">
      <span className="state-icon">{icon ?? <Inbox size={22} />}</span>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: Partial<StateProps> & { onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <span className="state-icon"><AlertTriangle size={22} /></span>
      <h3>{title}</h3>
      <p>{message ?? "We couldn't load this. Check your connection and try again."}</p>
      {onRetry ? <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, style }: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ display: "block", width, height, ...style }} aria-hidden="true" />;
}

export function LoadingRows({ rows = 4, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} height={height} />)}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}
