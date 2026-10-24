import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../services/authService";
import { FullPageLoading } from "./ProtectedRoute";

/** Only organization accounts get past this; everyone else goes to the feed. */
function OrganizationRoute() {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const token = localStorage.getItem("access");

  if (token && !currentUser) {
    return <FullPageLoading label="Loading your organization…" />;
  }
  if (currentUser?.role !== "organization") {
    return <Navigate to="/feed" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export default OrganizationRoute;
