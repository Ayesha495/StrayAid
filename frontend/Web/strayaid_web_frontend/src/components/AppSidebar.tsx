import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, ClipboardList, PawPrint, Newspaper, LogOut, CircleUserRound } from "lucide-react";
import { clearSession, useCurrentUser } from "../services/authSevice";
import { getOrganizationProfile } from "../services/platformService";
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

  useEffect(() => {
    if (!isOrganization) {
      setOrganizationName(null);
      return;
    }

    getOrganizationProfile()
      .then((profile) => setOrganizationName(profile.name))
      .catch(() => setOrganizationName(null));
  }, [isOrganization]);

  const displayName = isOrganization
    ? (organizationName || "Organization Account")
    : (currentUser?.username || "Rescue Account");

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
        <Link to="/organization/register" className="dashboard-profile" title={displayName} onClick={handleLinkClick}>
          <span className="dashboard-profile-icon"><CircleUserRound size={22} /></span>
          <span className="dashboard-profile-name">{displayName}</span>
        </Link>
        {isMobile ? (
          <button className="sidebar-toggle-btn" type="button" aria-label="Toggle menu" onClick={onToggle}>
            <MenuToggleIcon isOpen={true} />
          </button>
        ) : null}
      </div>

      <div className="dashboard-sidebar-separator" />

      <nav className="dashboard-nav">
        {isOrganization ? (
          <NavLink to="/dashboard" title="Dashboard" onClick={handleLinkClick}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </NavLink>
        ) : null}
        {isOrganization ? (
          <NavLink to="/cases" title="Rescue Cases" onClick={handleLinkClick}>
            <ClipboardList size={18} /> <span>Rescue Requests</span>
          </NavLink>
        ) : null}
        {isOrganization ? (
          <NavLink to="/animals" title="Animals" onClick={handleLinkClick}>
            <PawPrint size={18} /> <span>Rescued Animals</span>
          </NavLink>
        ) : null}
        <NavLink to={isOrganization ? "/org/feed" : "/feed"} title="Posts" onClick={handleLinkClick}>
          <Newspaper size={18} /> <span>Community Posts</span>
        </NavLink>
      </nav>

      {isOrganization ? null : (
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
