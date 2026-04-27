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
  const [animalPreviewCount, setAnimalPreviewCount] = useState(4);
  const [needsProfile, setNeedsProfile] = useState(false);
  const animalsUnderCare = animals.filter((animal) => animal.status !== "adopted");
  const visibleAnimals = animalsUnderCare.slice(0, animalPreviewCount);

  useEffect(() => {
    // Load the dashboard in parallel so the first view fills in progressively.
    getOrganizationProfile().then(() => setNeedsProfile(false)).catch(() => setNeedsProfile(true));
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  useEffect(() => {
    const syncAnimalPreviewCount = () => {
      setAnimalPreviewCount(window.innerWidth >= 1360 ? 4 : 3);
    };

    syncAnimalPreviewCount();
    window.addEventListener("resize", syncAnimalPreviewCount);
    return () => window.removeEventListener("resize", syncAnimalPreviewCount);
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
          <h1>{dashboard?.organization.name || "Organization Dashboard"}</h1>
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
        copy="See open reported cases on the map and track rescue flow through reported, in progress, rescued, and adoption-ready stages."
      />

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Recent Updates</h2>
            <p className="meta-line">Latest accepted and managed rescue cases.</p>
          </div>
        </div>
        <div className="card-grid">
          {dashboard?.recent_cases.length ? dashboard.recent_cases.map((caseItem) => (
            <article className="case-card" key={caseItem.id}>
              {caseItem.reports[0]?.image ? (
                <img
                  className="card-media report-media-fit"
                  src={caseItem.reports[0].image}
                  alt={`Case ${caseItem.id} report`}
                />
              ) : null}
              <span className="badge">{caseItem.status}</span>
              <h3>{caseItem.description}</h3>
              <p className="meta-line">Reported {new Date(caseItem.created_at).toLocaleString()}</p>
              <Link className="secondary-btn" to={`/cases/${caseItem.id}`}>View Details</Link>
            </article>
          )) : <div className="empty-state">No cases assigned yet.</div>}
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Animals Under Care</h2>
            <p className="meta-line">Rescued, recovering, and adoptable animals currently with your organization.</p>
          </div>
          <Link className="secondary-btn" to="/dashboard/workflow/under-care">Show More Animals</Link>
        </div>
        <div className="under-care-grid">
          {visibleAnimals.length ? visibleAnimals.map((animal) => (
            <Link className="animal-card under-care-card" key={animal.id} to={`/animals/${animal.id}`}>
              {animal.image ? <img className="card-media report-media-fit" src={animal.image} alt={animal.name} /> : null}
              <span className="badge">{animal.status}</span>
              <h3>{animal.name}</h3>
              <p className="meta-line">{animal.description || "Animal profile available for care updates."}</p>
              <span className="inline-link">View Profile</span>
            </Link>
          )) : <div className="empty-state">No active animal profiles under care yet.</div>}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
