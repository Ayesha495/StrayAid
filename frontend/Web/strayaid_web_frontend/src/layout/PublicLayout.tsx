import { Outlet } from "react-router-dom";
import Logo from "../ui/Logo";
import { useShell } from "./ShellContext";
import AuthenticatedShell from "../components/AuthenticatedShell";
import DsScope from "./DsScope";
import SiteNav from "./SiteNav";
import "./PublicLayout.css";

/** Top navigation for people who aren't signed in (shared with the landing page). */
export function PublicHeader() {
  return <SiteNav />;
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <Logo />
        <p className="small muted">Connecting people who spot injured strays with rescue teams nearby.</p>
        <p className="small muted">Report an animal in the StrayAid mobile app.</p>
      </div>
    </footer>
  );
}

function PublicLayout() {
  return (
    <div className="ds public-layout">
      <PublicHeader />
      <main className="public-main"><Outlet /></main>
      <PublicFooter />
    </div>
  );
}

/** Public pages: guests get the top navigation, signed-in people get their usual sidebar. */
export function AdaptiveLayout() {
  const { user } = useShell();
  return user ? (
    <AuthenticatedShell>
      <DsScope />
    </AuthenticatedShell>
  ) : (
    <PublicLayout />
  );
}

/** The newer signed-in pages, inside the original sidebar and top bar. */
export function ShellLayout() {
  return (
    <AuthenticatedShell>
      <DsScope />
    </AuthenticatedShell>
  );
}

export default PublicLayout;
