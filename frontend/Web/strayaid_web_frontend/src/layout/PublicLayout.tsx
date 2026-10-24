import { Outlet } from "react-router-dom";
import { useShell } from "./ShellContext";
import AuthenticatedShell from "../components/AuthenticatedShell";
import DsScope from "./DsScope";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import "./PublicLayout.css";

function PublicLayout() {
  return (
    <div className="ds public-layout">
      <SiteNav />
      <main className="public-main" id="main"><Outlet /></main>
      <SiteFooter />
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
