import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandinPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
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
import OrganizationFeed from "./pages/OrganizationFeed";
import WorkflowListPage from "./pages/WorkflowListPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/register" element={<Register />}></Route>
        <Route path="/feed" element={<PostFeed />}></Route>
        <Route path="/animals/browse" element={<AnimalDirectory />}></Route>
        <Route path="/animals/:animalId" element={<AnimalDetail />}></Route>
        <Route path="/organizations/:organizationId" element={<OrganizationPublicProfile />}></Route>
        {/* Authenticated setup flow */}
        <Route element={<ProtectedRoute />}>
          <Route path="/organization/register" element={<OrganizationRegistration />}></Route>
        </Route>
        {/* Organization workspace */}
        <Route element={<ProtectedRoute />}>
          <Route element={<OrganizationRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />}></Route>
            <Route path="/dashboard/workflow/:group" element={<WorkflowListPage />}></Route>
            <Route path="/cases" element={<Cases />}></Route>
            <Route path="/cases/:caseId" element={<CaseDetail />}></Route>
            <Route path="/animals" element={<AnimalManagement />}></Route>
            <Route path="/animals/manage" element={<AnimalManagement />}></Route>
            <Route path="/org/feed" element={<OrganizationFeed />}></Route>
          </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
