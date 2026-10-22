import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import LandingPage from "./pages/LandinPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import OrganizationRoute from "./components/OrganizationRoute";
import DashboardLayout from "./components/DashboardLayout";
import OrganizationRegistration from "./pages/OrganizationRegistration";
import Dashboard from "./pages/Dashboard";
import CaseDetail from "./pages/CaseDetail";
import AnimalManagement from "./pages/AnimalManagement";
import AnimalDetail from "./pages/AnimalDetail";
import AnimalDirectory from "./pages/AnimalDirectory";
import OrganizationPublicProfile from "./pages/OrganizationPublicProfile";
import PostFeed from "./pages/PostFeed";
import Cases from "./pages/Cases";
import WorkflowListPage from "./pages/WorkflowListPage";
import Applications from "./pages/Applications";
import Funds from "./pages/Funds";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Organizations from "./pages/Organizations";
import PublicCase from "./pages/PublicCase";
import MyReports from "./pages/MyReports";
import Following from "./pages/Following";
import MyApplications from "./pages/MyApplications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import DsScope from "./layout/DsScope";
import { AdaptiveLayout, ShellLayout } from "./layout/PublicLayout";
import { ShellProvider } from "./layout/ShellContext";
import { ToastProvider } from "./ui/Toast";

function App() {
  return (
    // Animations follow the person's "reduce motion" system setting.
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ToastProvider>
        <ShellProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Newer public pages: guests get the public header, signed-in people the sidebar */}
            <Route element={<AdaptiveLayout />}>
              <Route path="/feed" element={<PostFeed />} />
              <Route path="/animals/browse" element={<AnimalDirectory />} />
              <Route path="/animals/:animalId" element={<AnimalDetail />} />
              <Route path="/organizations" element={<Organizations />} />
              <Route path="/organizations/:organizationId" element={<OrganizationPublicProfile />} />
              <Route path="/organizations/:organizationId/posts" element={<PostFeed />} />
              <Route path="/case/:caseId" element={<PublicCase />} />
            </Route>

            {/* Signed in, any role */}
            <Route element={<ProtectedRoute />}>
              <Route path="/organization/register" element={<OrganizationRegistration />} />
              <Route element={<ShellLayout />}>
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:conversationId" element={<Messages />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/my-reports" element={<MyReports />} />
                <Route path="/following" element={<Following />} />
                <Route path="/my-applications" element={<MyApplications />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Organization workspace */}
            <Route element={<ProtectedRoute />}>
              <Route element={<OrganizationRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/dashboard/workflow/:group" element={<WorkflowListPage />} />
                  <Route path="/cases" element={<Cases />} />
                  <Route path="/cases/:caseId" element={<CaseDetail />} />
                  <Route path="/animals" element={<AnimalManagement />} />
                  <Route path="/animals/manage" element={<AnimalManagement />} />
                  <Route element={<DsScope />}>
                    <Route path="/applications" element={<Applications />} />
                    <Route path="/funds" element={<Funds />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="/org/feed" element={<Navigate to="/feed" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ShellProvider>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
