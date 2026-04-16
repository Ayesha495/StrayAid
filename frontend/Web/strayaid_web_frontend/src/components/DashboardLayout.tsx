import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import "./DashboardLayout.css";

function DashboardLayout() {
  return (
    <div className="dashboard-shell">
      <AppSidebar />
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
