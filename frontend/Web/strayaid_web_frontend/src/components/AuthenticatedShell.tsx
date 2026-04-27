import { useEffect, useState } from "react";
import AppSidebar from "./AppSidebar";
import MenuToggleIcon from "./MenuToggleIcon";
import "./DashboardLayout.css";

type AuthenticatedShellProps = {
  children: React.ReactNode;
};

const SIDEBAR_PREFERENCE_KEY = "strayaid-sidebar-collapsed";
const MOBILE_BREAKPOINT = "(max-width: 900px)";

function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT).matches);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => (
    localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true"
  ));
  const [mobileCollapsed, setMobileCollapsed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setMobileCollapsed(true);
      }
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(desktopCollapsed));
  }, [desktopCollapsed]);

  const isCollapsed = isMobile ? mobileCollapsed : desktopCollapsed;
  const isSidebarOpen = !isCollapsed;

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileCollapsed((current) => !current);
      return;
    }

    setDesktopCollapsed((current) => !current);
  };

  return (
    <div className={`dashboard-shell${isSidebarOpen ? " sidebar-open" : ""}`}>
      {isSidebarOpen ? <button className="dashboard-backdrop" type="button" aria-label="Close menu" onClick={handleToggleSidebar} /> : null}
      <AppSidebar
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        onToggle={handleToggleSidebar}
      />
      <main className="dashboard-content">
        {!isSidebarOpen ? (
          <button
            className="sidebar-reopen-btn"
            type="button"
            aria-label="Open menu"
            onClick={handleToggleSidebar}
          >
            <MenuToggleIcon isOpen={false} />
          </button>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export default AuthenticatedShell;
