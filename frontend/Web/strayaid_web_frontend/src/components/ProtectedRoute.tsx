import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { clearSession, syncCurrentUser, useCurrentUser } from "../services/authService";
import { Spinner } from "../ui/States";

export function FullPageLoading({ label }: { label: string }) {
  return (
    <div className="state" style={{ minHeight: "60vh", justifyContent: "center" }}>
      <Spinner label={label} />
      <p>{label}</p>
    </div>
  );
}

function ProtectedRoute() {
  const token = localStorage.getItem("access");
  const location = useLocation();
  const user = useCurrentUser();
  const [failed, setFailed] = useState(false);

  // After a hard refresh there's a token but no cached user: load it once.
  useEffect(() => {
    if (!token || user) return;
    syncCurrentUser().catch(() => {
      clearSession();
      setFailed(true);
    });
  }, [token, user]);

  if (!token || failed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user) {
    return <FullPageLoading label="Loading your account…" />;
  }
  return <Outlet />;
}

export default ProtectedRoute;
