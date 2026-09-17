import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Folder,
  MapPin,
  MoreHorizontal,
  PawPrint,
  Plus,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import { acceptCase, getCases, getDashboard, getOrganizationAnimals, getOrganizationProfile } from "../services/platformService";
import type { Animal, Case, DashboardData } from "../types/platform";
import { formatRelativeTime, minutesSince } from "../utils/time";
import "../styles/Portal.css";
import "../styles/Dashboard.css";

type ActivityFilter = "all" | "rescues" | "updates";

function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalPreviewCount, setAnimalPreviewCount] = useState(4);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const animalsUnderCare = animals.filter((animal) => animal.status !== "adopted");
  const visibleAnimals = animalsUnderCare.slice(0, animalPreviewCount);

  const loadCasesAndDashboard = () => {
    getDashboard().then(setDashboard).catch(() => setDashboard(null));
    getCases().then(setCases).catch(() => setCases([]));
  };

  useEffect(() => {
    getOrganizationProfile().then(() => setNeedsProfile(false)).catch(() => setNeedsProfile(true));
    loadCasesAndDashboard();
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

  const openRescueCases = useMemo(() => {
    return cases
      .filter((caseItem) => !caseItem.organization && caseItem.status === "reported")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 4);
  }, [cases]);

  const activityItems = useMemo(() => {
    const items = (dashboard?.recent_cases ?? [])
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (activityFilter === "rescues") {
      return items.filter((caseItem) => caseItem.status === "rescued");
    }
    if (activityFilter === "updates") {
      return items.filter((caseItem) => caseItem.status !== "rescued");
    }
    return items;
  }, [dashboard, activityFilter]);

  const handleAcceptCase = async (caseId: number) => {
    setAcceptingId(caseId);
    try {
      await acceptCase(caseId);
      loadCasesAndDashboard();
    } finally {
      setAcceptingId(null);
    }
  };

  const handleExportReport = () => {
    const rows = [
      ["Case ID", "Status", "Description", "Reported At", "Distance (km)"],
      ...cases.map((caseItem) => [
        String(caseItem.id),
        caseItem.status,
        `"${caseItem.description.replace(/"/g, '""')}"`,
        caseItem.created_at,
        caseItem.distance_km != null ? String(caseItem.distance_km) : "",
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `strayaid-cases-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="portal-page overview-page">
      <div className="overview-header">
        <div>
          <h1>Overview</h1>
          <p className="overview-subtitle">Here's what's happening today in your operational area.</p>
        </div>
        <div className="overview-actions">
          <button className="overview-btn-outline" type="button" onClick={handleExportReport}>
            <Download size={16} /> Export Report
          </button>
          <Link className="overview-btn-filled" to="/animals/manage">
            <Plus size={16} /> New Entry
          </Link>
        </div>
      </div>

      {dashboard && (
        <div className="overview-stats">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-tag">All Time</span>
              <span className="stat-icon"><Folder size={18} /></span>
            </div>
            <strong>{dashboard.summary.total_cases}</strong>
            <span className="stat-label">Total Cases</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-tag">Current</span>
              <span className="stat-icon"><Activity size={18} /></span>
            </div>
            <strong>{dashboard.summary.active_cases}</strong>
            <span className="stat-label">Active Rescues</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-tag">Current</span>
              <span className="stat-icon"><PawPrint size={18} /></span>
            </div>
            <strong>{dashboard.summary.animals_count}</strong>
            <span className="stat-label">Animals Under Care</span>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-tag">All Time</span>
              <span className="stat-icon"><TrendingUp size={18} /></span>
            </div>
            <strong>{dashboard.summary.adoption_cases}</strong>
            <span className="stat-label">Successful Adoptions</span>
          </div>
        </div>
      )}

      <div className="overview-split">
        <section className="panel-card overview-rescue-board">
          <div className="section-heading">
            <div>
              <h2>Active Rescue Board</h2>
              <p className="meta-line">Unclaimed reports waiting for a response, oldest first.</p>
            </div>
            <Link className="inline-link" to="/cases">View All &gt;</Link>
          </div>

          {openRescueCases.length ? (
            <div className="rescue-board-grid">
              {openRescueCases.map((caseItem) => {
                const elapsedMinutes = minutesSince(caseItem.created_at);
                const isHighPriority = elapsedMinutes > 120;
                const thumbnail = caseItem.reports[0]?.image;

                return (
                  <article className="rescue-case-card" key={caseItem.id}>
                    <div className="rescue-case-media">
                      {thumbnail ? (
                        <img src={thumbnail} alt={`Case ${caseItem.id} report`} />
                      ) : (
                        <div className="rescue-case-media-placeholder"><MapPin size={22} /></div>
                      )}
                      <span className={`priority-badge ${isHighPriority ? "priority-high" : "priority-medium"}`}>
                        {isHighPriority ? "High Priority" : "Medium Priority"}
                      </span>
                      {caseItem.distance_km != null ? (
                        <span className="distance-chip"><MapPin size={12} /> {caseItem.distance_km.toFixed(1)} km</span>
                      ) : null}
                    </div>
                    <p className="meta-line">Case #R-{caseItem.id} &middot; Reported {formatRelativeTime(caseItem.created_at)}</p>
                    <h3 className="rescue-case-title">{caseItem.description}</h3>
                    <div className="rescue-case-actions">
                      <button
                        className="overview-btn-filled"
                        type="button"
                        disabled={acceptingId === caseItem.id}
                        onClick={() => handleAcceptCase(caseItem.id)}
                      >
                        {acceptingId === caseItem.id ? "Accepting..." : "Accept Case"}
                      </button>
                      <Link className="icon-btn" to={`/cases/${caseItem.id}`} aria-label="View case details">
                        <MoreHorizontal size={18} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-state">No unclaimed cases waiting right now.</div>
          )}
        </section>

        <section className="panel-card overview-activity">
          <div className="section-heading">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-tabs">
            {(["all", "rescues", "updates"] as ActivityFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`activity-tab${activityFilter === tab ? " is-active" : ""}`}
                onClick={() => setActivityFilter(tab)}
              >
                {tab === "all" ? "All" : tab === "rescues" ? "Rescues" : "Updates"}
              </button>
            ))}
          </div>
          <div className="activity-list">
            {activityItems.length ? activityItems.map((caseItem) => {
              const isRescued = caseItem.status === "rescued";
              const isInProgress = ["assigned", "in_progress"].includes(caseItem.status);
              const Icon = isRescued ? CheckCircle2 : isInProgress ? UserPlus : FileText;

              return (
                <div className="activity-item" key={caseItem.id}>
                  <span className={`activity-icon ${isRescued ? "activity-icon-success" : isInProgress ? "activity-icon-info" : "activity-icon-warn"}`}>
                    <Icon size={14} />
                  </span>
                  <div>
                    <p className="activity-text">
                      Case #R-{caseItem.id} {isRescued ? "marked as Rescued" : isInProgress ? "is in progress" : `filed as ${caseItem.status}`}
                    </p>
                    <p className="meta-line">{formatRelativeTime(caseItem.updated_at)} &middot; {caseItem.organization?.name || "Unassigned"}</p>
                  </div>
                </div>
              );
            }) : <div className="empty-state compact-state">No recent activity yet.</div>}
          </div>
        </section>
      </div>

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
            <AnimalCard
              key={animal.id}
              animal={animal}
              footer={
                <Link className="am-public-link" to={`/animals/${animal.id}`}>
                  <ExternalLink size={14} /> View Profile
                </Link>
              }
            />
          )) : <div className="empty-state">No active animal profiles under care yet.</div>}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
