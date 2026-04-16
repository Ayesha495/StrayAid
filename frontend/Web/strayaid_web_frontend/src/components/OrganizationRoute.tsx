import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../services/authSevice";

function OrganizationRoute() {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const token = localStorage.getItem("access");

  if (token && !currentUser) {
    return <div className="empty-state">Loading your organization access...</div>;
  }

  if (currentUser?.role !== "organization") {
    return <Navigate to="/feed" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default OrganizationRoute;
