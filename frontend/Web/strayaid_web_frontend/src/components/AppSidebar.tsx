import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearSession, useCurrentUser } from "../services/authSevice";

function AppSidebar() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isOrganization = currentUser?.role === "organization";

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <aside className="dashboard-sidebar">
      <Link to="/" className="dashboard-brand">StrayAid</Link>
      <div className="dashboard-user-card">
        <strong>{currentUser?.username || "Rescue Account"}</strong>
        <span>{isOrganization ? "Organization Access" : "Public Access"}</span>
      </div>
      <nav className="dashboard-nav">
        {isOrganization ? <NavLink to="/dashboard">Dashboard</NavLink> : null}
        {isOrganization ? <NavLink to="/cases">Cases</NavLink> : null}
        {isOrganization ? <NavLink to="/animals">Animals</NavLink> : null}
        <NavLink to={isOrganization ? "/org/feed" : "/feed"}>Feed</NavLink>
      </nav>
      <NavLink to="/organization/register" className="dashboard-secondary-link">
        {isOrganization ? "Organization Profile" : "Register As Organization"}
      </NavLink>
      <button className="dashboard-logout" onClick={handleLogout}>Logout</button>
    </aside>
  );
}

export default AppSidebar;
