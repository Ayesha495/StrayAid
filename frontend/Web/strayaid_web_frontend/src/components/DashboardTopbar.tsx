import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useCurrentUser } from "../services/authSevice";
import { MessagesPanel, NotificationsPanel } from "../layout/TopbarPanels";

const BREADCRUMBS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/workflow", label: "Rescue Workflow" },
  { prefix: "/dashboard", label: "Operations Dashboard" },
  { prefix: "/cases", label: "Cases & Workflow" },
  { prefix: "/animals/browse", label: "Meet the animals" },
  { prefix: "/animals", label: "Animal Profiles & Adoption" },
  { prefix: "/org/feed", label: "Public Community Feed" },
  { prefix: "/feed", label: "Public Community Feed" },
  { prefix: "/organization/register", label: "Organization Settings" },
  { prefix: "/applications", label: "Adoption Applications" },
  { prefix: "/funds", label: "Funds & Receipts" },
  { prefix: "/messages", label: "Messages" },
  { prefix: "/notifications", label: "Notifications" },
  { prefix: "/my-reports", label: "My Reports" },
  { prefix: "/following", label: "Following" },
  { prefix: "/my-applications", label: "Adopt & Sponsor" },
  { prefix: "/organizations", label: "Organizations" },
  { prefix: "/case/", label: "Rescue Case" },
  { prefix: "/settings", label: "Settings" },
];

function DashboardTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState("");

  const initial = (currentUser?.username || "U").trim().charAt(0).toUpperCase();
  const isOrganization = currentUser?.role === "organization";
  const breadcrumb = BREADCRUMBS.find((item) => location.pathname.startsWith(item.prefix))?.label ?? (isOrganization ? "Operations Dashboard" : "Community");

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
        <span className="dashboard-breadcrumb-brand">{isOrganization ? "StrayAid Operations" : "StrayAid"}</span>
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
