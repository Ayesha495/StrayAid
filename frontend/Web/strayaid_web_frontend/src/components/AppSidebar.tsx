import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

  const handleLogout = () => {
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
          <span className="dashboard-brand-full">StrayAid</span>
        </Link>
        <button className="sidebar-toggle-btn" type="button" aria-label="Toggle menu" onClick={onToggle}>
          <MenuToggleIcon isOpen={true} />
        </button>
      </div>
      <div className="dashboard-user-card" title={isOrganization ? (organizationName || "Organization Account") : (currentUser?.username || "Rescue Account")}>
        <strong>{isOrganization ? (organizationName || "Organization Account") : (currentUser?.username || "Rescue Account")}</strong>
        <span>{isOrganization ? "Organization Access" : "Public Access"}</span>
      </div>
      <nav className="dashboard-nav">
        {isOrganization ? <NavLink to="/dashboard" title="Dashboard" onClick={handleLinkClick}><span>Dashboard</span></NavLink> : null}
        {isOrganization ? <NavLink to="/cases" title="Cases" onClick={handleLinkClick}><span>Cases</span></NavLink> : null}
        {isOrganization ? <NavLink to="/animals" title="Animals" onClick={handleLinkClick}><span>Animals</span></NavLink> : null}
        <NavLink to={isOrganization ? "/org/feed" : "/feed"} title="Feed" onClick={handleLinkClick}><span>Feed</span></NavLink>
      </nav>
      <NavLink to="/organization/register" className="dashboard-secondary-link" title={isOrganization ? "Organization Profile" : "Register As Organization"} onClick={handleLinkClick}>
        <span>{isOrganization ? "Organization Profile" : "Register As Organization"}</span>
      </NavLink>
      <button className="dashboard-logout" onClick={handleLogout} title="Logout">
        <span>Logout</span>
      </button>
    </aside>
  );
}

export default AppSidebar;
