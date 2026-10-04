import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { useCurrentUser } from "../services/authSevice";

const BREADCRUMBS: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard/workflow", label: "Rescue Workflow" },
  { prefix: "/dashboard", label: "Operations Dashboard" },
  { prefix: "/cases", label: "Cases & Workflow" },
  { prefix: "/animals", label: "Animal Profiles & Adoption" },
  { prefix: "/org/feed", label: "Public Community Feed" },
  { prefix: "/feed", label: "Public Community Feed" },
  { prefix: "/organization/register", label: "Organization Settings" },
];

function DashboardTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState("");

  const initial = (currentUser?.username || "U").trim().charAt(0).toUpperCase();
  const breadcrumb = BREADCRUMBS.find((item) => location.pathname.startsWith(item.prefix))?.label ?? "Operations Dashboard";

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/cases?q=${encodeURIComponent(trimmed)}` : "/cases");
  };

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-breadcrumb">
        <span className="dashboard-breadcrumb-brand">StrayAid Operations</span>
        <span className="dashboard-breadcrumb-sep">/</span>
        <span className="dashboard-breadcrumb-current">{breadcrumb}</span>
      </div>
      <form className="dashboard-search" onSubmit={handleSearchSubmit} role="search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search cases, animals, microchip ID..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="dashboard-topbar-actions">
        <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <Link to="/organization/register" className="dashboard-avatar" title="Organization Profile">
          {initial}
        </Link>
      </div>
    </header>
  );
}

export default DashboardTopbar;
