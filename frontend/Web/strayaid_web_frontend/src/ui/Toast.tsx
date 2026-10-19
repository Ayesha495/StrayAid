import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

export type ToastTone = "default" | "urgent" | "error";

export type ToastInput = {
  title: string;
  body?: string;
  tone?: ToastTone;
  link?: { to: string; label: string };
};

type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

const VISIBLE_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), VISIBLE_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ds toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.tone && toast.tone !== "default" ? ` toast-${toast.tone}` : ""}`} role="status">
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              {toast.body ? <div className="toast-body">{toast.body}</div> : null}
              {toast.link ? (
                <Link className="link small" to={toast.link.to} onClick={() => dismiss(toast.id)}>
                  {toast.link.label}
                </Link>
              ) : null}
            </div>
            <button type="button" className="sa-icon-btn" style={{ width: 26, height: 26 }} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
