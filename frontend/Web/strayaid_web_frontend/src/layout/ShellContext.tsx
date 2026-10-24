import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCurrentUser } from "../services/authService";
import { getOrganizationProfile } from "../services/platformService";
import { getUnreadCounts } from "../services/notificationService";
import { usePolling } from "../hooks/useApi";
import type { Organization } from "../types/platform";
import type { CurrentUser } from "../types/authTypes";
import type { UnreadCounts } from "../types/api";

// The bell and chat badges poll this often (the backend has no websockets).
export const UNREAD_POLL_MS = 30_000;

type ShellValue = {
  user: CurrentUser | null;
  isOrganization: boolean;
  organization: Organization | null;
  setOrganization: (organization: Organization) => void;
  unread: UnreadCounts;
  refreshUnread: () => void;
};

const ShellContext = createContext<ShellValue>({
  user: null,
  isOrganization: false,
  organization: null,
  setOrganization: () => {},
  unread: { notifications: 0, messages: 0 },
  refreshUnread: () => {},
});

export function ShellProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const isOrganization = user?.role === "organization";
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [unread, setUnread] = useState<UnreadCounts>({ notifications: 0, messages: 0 });

  useEffect(() => {
    if (!isOrganization) return;
    let active = true;
    getOrganizationProfile()
      .then((profile) => active && setOrganization(profile))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOrganization]);

  const refreshUnread = useCallback(() => {
    if (!user) return;
    getUnreadCounts().then(setUnread).catch(() => {});
  }, [user]);

  useEffect(refreshUnread, [refreshUnread]);
  usePolling(refreshUnread, UNREAD_POLL_MS, Boolean(user));

  const value = useMemo(
    () => ({ user, isOrganization, organization: isOrganization ? organization : null, setOrganization, unread, refreshUnread }),
    [user, isOrganization, organization, unread, refreshUnread],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useShell = () => useContext(ShellContext);
