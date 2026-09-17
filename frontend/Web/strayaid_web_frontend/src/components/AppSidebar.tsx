import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, ClipboardList, PawPrint, Newspaper, ShieldCheck, LogOut } from "lucide-react";
import { clearSession, useCurrentUser } from "../services/authSevice";
import { getDashboard, getOrganizationProfile } from "../services/platformService";
import MenuToggleIcon from "./MenuToggleIcon";

type AppSidebarProps = {
  isCollapsed: boolean;
  isMobile: boolean;
  onToggle: () => void;
};

function AppSidebar({ isCollapsed, isMobile, onToggle }: AppSidebarProps) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isOrganization = currentUser?.role === "organization";
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [counts, setCounts] = useState<{ cases: number; animals: number; posts: number } | null>(null);

  useEffect(() => {
    if (!isOrganization) {
      setOrganizationName(null);
      setCounts(null);
      return;
    }

    getOrganizationProfile()
      .then((profile) => {
        setOrganizationName(profile.name);
        setIsVerified(Boolean(profile.is_verified));
      })
      .catch(() => setOrganizationName(null));

    getDashboard()
      .then((data) => setCounts({
        cases: data.summary.active_cases,
        animals: data.summary.animals_count,
        posts: data.summary.posts_count,
      }))
      .catch(() => setCounts(null));
  }, [isOrganization]);

  const handleLogout = () => {
    const shouldLogout = window.confirm("Are you sure you want to log out?");
    if (!shouldLogout) {
      return;
    }
    clearSession();
    navigate("/login");
  };

  const handleLinkClick = () => {
    if (isMobile) {
      onToggle();
    }
  };

  return (
    <aside className={`dashboard-sidebar${isCollapsed ? " is-collapsed" : ""}`}>
      <div className="dashboard-sidebar-top">
        <Link to="/" className="dashboard-brand" title="StrayAid">
          <span className="dashboard-brand-icon"><PawPrint size={20} /></span>
          <span className="dashboard-brand-text">
            <span className="dashboard-brand-full">StrayAid</span>
            <span className="dashboard-brand-sub">Rescue Ops</span>
          </span>
        </Link>
        <button className="sidebar-toggle-btn" type="button" aria-label="Toggle menu" onClick={onToggle}>
          <MenuToggleIcon isOpen={true} />
        </button>
      </div>

      <div className="dashboard-user-card" title={isOrganization ? (organizationName || "Organization Account") : (currentUser?.username || "Rescue Account")}>
        <strong>{isOrganization ? (organizationName || "Organization Account") : (currentUser?.username || "Rescue Account")}</strong>
        <span><ShieldCheck size={14} /> {isOrganization ? (isVerified ? "Verified Hub" : "Pending Verification") : "Public Access"}</span>
      </div>

      <nav className="dashboard-nav">
        {isOrganization ? (
          <NavLink to="/dashboard" title="Dashboard" onClick={handleLinkClick}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </NavLink>
        ) : null}
        {isOrganization ? (
          <NavLink to="/cases" title="Rescue Cases" onClick={handleLinkClick}>
            <ClipboardList size={18} /> <span>Rescue Requests</span>
            {counts ? <span className="dashboard-nav-badge">{counts.cases}</span> : null}
          </NavLink>
        ) : null}
        {isOrganization ? (
          <NavLink to="/animals" title="Animals" onClick={handleLinkClick}>
            <PawPrint size={18} /> <span>Rescued Animals</span>
            {counts ? <span className="dashboard-nav-badge">{counts.animals}</span> : null}
          </NavLink>
        ) : null}
        <NavLink to={isOrganization ? "/org/feed" : "/feed"} title="Posts" onClick={handleLinkClick}>
          <Newspaper size={18} /> <span>Community Posts</span>
          {isOrganization && counts ? <span className="dashboard-nav-badge">{counts.posts}</span> : null}
        </NavLink>
      </nav>

      {isOrganization ? (
        <div className="dashboard-nav-section">
          <span className="dashboard-nav-section-label">Administration</span>
          <nav className="dashboard-nav">
            <NavLink to="/organization/register" title="Organization Profile" onClick={handleLinkClick}>
              <ShieldCheck size={18} /> <span>Organization Profile</span>
            </NavLink>
          </nav>
        </div>
      ) : (
        <NavLink to="/organization/register" className="dashboard-secondary-link" title="Register As Organization" onClick={handleLinkClick}>
          <span>Register As Organization</span>
        </NavLink>
      )}

      <button className="dashboard-logout" onClick={handleLogout} title="Logout">
        <LogOut size={16} /> <span>Logout</span>
      </button>
    </aside>
  );
}

export default AppSidebar;
