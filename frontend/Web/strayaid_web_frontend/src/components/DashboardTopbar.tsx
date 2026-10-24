import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useCurrentUser } from "../services/authService";
import { MessagesPanel, NotificationsPanel } from "../layout/TopbarPanels";

const BREADCRUMBS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/workflow", label: "Rescue workflow" },
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/cases", label: "Rescue requests" },
  { prefix: "/animals/browse", label: "Animals" },
  { prefix: "/animals", label: "Rescued animals" },
  { prefix: "/org/feed", label: "Community posts" },
  { prefix: "/feed", label: "Community posts" },
  { prefix: "/organization/register", label: "Organization profile" },
  { prefix: "/applications", label: "Applications" },
  { prefix: "/funds", label: "Funds" },
  { prefix: "/messages", label: "Messages" },
  { prefix: "/notifications", label: "Notifications" },
  { prefix: "/my-reports", label: "My reports" },
  { prefix: "/following", label: "Following" },
  { prefix: "/my-applications", label: "Adopt & sponsor" },
  { prefix: "/organizations", label: "Rescue teams" },
  { prefix: "/case/", label: "Rescue case" },
  { prefix: "/settings", label: "Settings" },
];

function DashboardTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState("");

  const initial = (currentUser?.username || "U").trim().charAt(0).toUpperCase();
  const isOrganization = currentUser?.role === "organization";
  const breadcrumb = BREADCRUMBS.find((item) => location.pathname.startsWith(item.prefix))?.label ?? (isOrganization ? "Dashboard" : "Community");

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    // Teams search their cases; everyone else searches the animals directory.
    const base = isOrganization ? "/cases" : "/animals/browse";
    navigate(trimmed ? `${base}?q=${encodeURIComponent(trimmed)}` : base);
  };

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-breadcrumb">
        <span className="dashboard-breadcrumb-brand">StrayAid</span>
        <span className="dashboard-breadcrumb-sep">/</span>
        <span className="dashboard-breadcrumb-current">{breadcrumb}</span>
      </div>
      <form className="dashboard-search" onSubmit={handleSearchSubmit} role="search">
        <Search size={16} />
        <input
          type="search"
          placeholder={isOrganization ? "Search cases, animals, microchip ID..." : "Search animals by name or breed"}
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="dashboard-topbar-actions">
        <MessagesPanel buttonClassName="dashboard-icon-btn" />
        <NotificationsPanel buttonClassName="dashboard-icon-btn" />
        <Link
          to={currentUser?.role === "organization" ? "/organization/register" : "/settings"}
          className="dashboard-avatar"
          title={currentUser?.role === "organization" ? "Organization Profile" : "Settings"}
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}

export default DashboardTopbar;
