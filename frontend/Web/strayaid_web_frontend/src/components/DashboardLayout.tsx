import { Outlet } from "react-router-dom";
import AuthenticatedShell from "./AuthenticatedShell";

function DashboardLayout() {
  return (
    <AuthenticatedShell>
        <Outlet />
    </AuthenticatedShell>
  );
}

export default DashboardLayout;
