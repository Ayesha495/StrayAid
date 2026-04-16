import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RescueBoard from "../components/RescueBoard";
import { getCases, getDashboard, getOrganizationAnimals, getOrganizationProfile } from "../services/platformService";
import type { Animal, Case, DashboardData } from "../types/platform";
import "../styles/Portal.css";

function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    getOrganizationProfile().then(() => setNeedsProfile(false)).catch(() => setNeedsProfile(true));
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  if (needsProfile) {
    return (
      <div className="portal-page">
        <div className="empty-state">
          <h1>Complete your organization profile first</h1>
          <p>Your dashboard unlocks once your rescue organization details are saved.</p>
          <Link className="primary-btn" to="/organization/register">Create Organization Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Organization Dashboard</h1>
          <p>Track incoming rescue work, accepted cases, and animals currently under your care.</p>
        </div>
      </div>

      {dashboard && (
        <div className="summary-grid">
          <div className="summary-card"><strong>{dashboard.summary.total_cases}</strong><span>Total Cases</span></div>
          <div className="summary-card"><strong>{dashboard.summary.active_cases}</strong><span>Active Cases</span></div>
          <div className="summary-card"><strong>{dashboard.summary.animals_count}</strong><span>Animals Managed</span></div>
          <div className="summary-card"><strong>{dashboard.summary.posts_count}</strong><span>Public Updates</span></div>
        </div>
      )}

      <RescueBoard
        cases={cases}
        animals={animals}
        heading="Rescue Dashboard"
        copy="See open reported cases on the map, track rescue work in progress, and jump into animal profiles as the case lifecycle advances."
      />

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Recent Activity</h2>
            <p className="meta-line">Your latest accepted or managed cases.</p>
          </div>
        </div>
        <div className="card-grid">
          {dashboard?.recent_cases.length ? dashboard.recent_cases.map((caseItem) => (
            <article className="case-card" key={caseItem.id}>
              <span className="badge">{caseItem.status}</span>
              <h3>{caseItem.description}</h3>
              <p className="meta-line">Reported {new Date(caseItem.created_at).toLocaleString()}</p>
              <Link className="secondary-btn" to={`/cases/${caseItem.id}`}>View Details</Link>
            </article>
          )) : <div className="empty-state">No cases assigned yet.</div>}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
