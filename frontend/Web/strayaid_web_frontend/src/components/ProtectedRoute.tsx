import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getStoredUser, syncCurrentUser, clearSession, useCurrentUser } from "../services/authSevice";

function ProtectedRoute() {
  const token = localStorage.getItem("access");
  const location = useLocation();
  useCurrentUser();
  // If we already have a cached user, skip the loading gate on first paint.
  const [isReady, setIsReady] = useState(() => Boolean(!token || getStoredUser()));

  useEffect(() => {
    if (!token || getStoredUser()) {
      setIsReady(true);
      return;
    }

    // Rehydrate the current user after a hard refresh.
    syncCurrentUser()
      .then(() => setIsReady(true))
      .catch(() => {
        clearSession();
        setIsReady(true);
      });
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isReady) {
    return <div className="empty-state">Loading your account...</div>;
  }

  return <Outlet />;
}

export default ProtectedRoute;
