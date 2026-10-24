import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import OrganizationRoute from "./components/OrganizationRoute";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import DsScope from "./layout/DsScope";
import { AdaptiveLayout, ShellLayout } from "./layout/PublicLayout";
import { ShellProvider } from "./layout/ShellContext";
import { ToastProvider } from "./ui/Toast";
import { Spinner } from "./ui/States";

const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const OrganizationRegistration = lazy(() => import("./pages/OrganizationRegistration"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const AnimalManagement = lazy(() => import("./pages/AnimalManagement"));
const AnimalDetail = lazy(() => import("./pages/AnimalDetail"));
const AnimalDirectory = lazy(() => import("./pages/AnimalDirectory"));
const OrganizationPublicProfile = lazy(() => import("./pages/OrganizationPublicProfile"));
const PostFeed = lazy(() => import("./pages/PostFeed"));
const Cases = lazy(() => import("./pages/Cases"));
const WorkflowListPage = lazy(() => import("./pages/WorkflowListPage"));
const Applications = lazy(() => import("./pages/Applications"));
const Funds = lazy(() => import("./pages/Funds"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Organizations = lazy(() => import("./pages/Organizations"));
const PublicCase = lazy(() => import("./pages/PublicCase"));
const MyReports = lazy(() => import("./pages/MyReports"));
const Following = lazy(() => import("./pages/Following"));
const MyApplications = lazy(() => import("./pages/MyApplications"));
const Settings = lazy(() => import("./pages/Settings"));
const LegalPage = lazy(() => import("./pages/LegalPage"));

function App() {
  return (
    // Animations follow the person's "reduce motion" system setting.
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ToastProvider>
        <ShellProvider>
          <Suspense fallback={<div className="page-loading"><Spinner label="Loading page" /></div>}>
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
              <Route path="/legal/:doc" element={<LegalPage />} />
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
            <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
            <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
            <Route path="/delete-account" element={<Navigate to="/legal/delete-account" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ShellProvider>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
