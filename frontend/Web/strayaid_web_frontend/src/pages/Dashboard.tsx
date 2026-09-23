import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Folder,
  MapPin,
  PawPrint,
  Plus,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import ConcentricRingChart from "../components/ConcentricRingChart";
import CasesTrendChart from "../components/CasesTrendChart";
import CaseLocationModal from "../components/CaseLocationModal";
import { acceptCase, getCases, getDashboard, getOrganizationAnimals, getOrganizationProfile } from "../services/platformService";
import type { Animal, Case, DashboardData } from "../types/platform";
import { formatRelativeTime, minutesSince } from "../utils/time";
import "../styles/Portal.css";
import "../styles/Dashboard.css";

type ActivityFilter = "all" | "rescues" | "updates";

function pct(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function Dashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalPreviewCount, setAnimalPreviewCount] = useState(4);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [mapCase, setMapCase] = useState<Case | null>(null);

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

  const reportedCount = useMemo(() => cases.filter((caseItem) => caseItem.status === "reported").length, [cases]);

  const openRescueCases = useMemo(() => {
    return cases
      .filter((caseItem) => !caseItem.organization && caseItem.status === "reported")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 4);
  }, [cases]);

  const trendChart = useMemo(() => {
    const dayKeys: string[] = [];
    const labels: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dayKeys.push(date.toISOString().slice(0, 10));
      labels.push(date.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }
    const dayIndex = new Map(dayKeys.map((key, index) => [key, index]));

    const reported = new Array(dayKeys.length).fill(0);
    const active = new Array(dayKeys.length).fill(0);
    const rescued = new Array(dayKeys.length).fill(0);
    const adopted = new Array(dayKeys.length).fill(0);

    cases.forEach((caseItem) => {
      const index = dayIndex.get(new Date(caseItem.created_at).toISOString().slice(0, 10));
      if (index === undefined) {
        return;
      }
      if (caseItem.status === "reported") {
        reported[index] += 1;
      } else if (["assigned", "in_progress"].includes(caseItem.status)) {
        active[index] += 1;
      } else if (caseItem.status === "rescued") {
        rescued[index] += 1;
      }
    });

    animals.forEach((animal) => {
      if (animal.status !== "adopted") {
        return;
      }
      const index = dayIndex.get(new Date(animal.created_at).toISOString().slice(0, 10));
      if (index !== undefined) {
        adopted[index] += 1;
      }
    });

    return {
      labels,
      series: [
        { label: "Reported", color: "#1d4ed8", values: reported },
        { label: "Active", color: "#b45309", values: active },
        { label: "Rescued", color: "#15803d", values: rescued },
        { label: "Adopted", color: "#6d28d9", values: adopted },
      ],
    };
  }, [cases, animals]);

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
        <div className="overview-stats-row">
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

          <div className="overview-chart-col">
            <div className="panel-card overview-ring-card">
              <ConcentricRingChart
                centerValue={String(dashboard.summary.total_cases)}
                centerLabel="Total Cases"
                rings={[
                  { label: "Reported", value: pct(reportedCount, dashboard.summary.total_cases), color: "#14532d" },
                  { label: "Active", value: pct(dashboard.summary.active_cases, dashboard.summary.total_cases), color: "#15803d" },
                  { label: "Rescued", value: pct(dashboard.summary.rescued_cases, dashboard.summary.total_cases), color: "#16a34a" },
                  { label: "Adopted", value: pct(dashboard.summary.adoption_cases, dashboard.summary.total_cases), color: "#22c55e" },
                ]}
              />
            </div>
            <div className="panel-card overview-trend-card">
              <div className="section-heading">
                <div>
                  <h2>Case Activity</h2>
                  <p className="meta-line">Reported, active, rescued, and adopted &middot; last 14 days.</p>
                </div>
              </div>
              <CasesTrendChart labels={trendChart.labels} series={trendChart.series} />
            </div>
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
            <div className="rescue-board-list">
              {openRescueCases.map((caseItem) => {
                const elapsedMinutes = minutesSince(caseItem.created_at);
                const isHighPriority = elapsedMinutes > 120;
                const goToCase = () => navigate(`/cases/${caseItem.id}`);

                return (
                  <article
                    className="rescue-case-card"
                    key={caseItem.id}
                    role="link"
                    tabIndex={0}
                    onClick={goToCase}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        goToCase();
                      }
                    }}
                  >
                    <div className="rescue-case-content">
                      <div className="rescue-case-id-row">
                        <span className="rescue-case-number">Case #R-{caseItem.id}</span>
                        <span className={`priority-badge ${isHighPriority ? "priority-high" : "priority-medium"}`}>
                          {isHighPriority ? "High" : "Medium"}
                        </span>
                      </div>
                      <p className="meta-line">
                        Reported {formatRelativeTime(caseItem.created_at)}
                        {caseItem.distance_km != null ? <> &middot; {caseItem.distance_km.toFixed(1)} km away</> : null}
                      </p>
                      <p className="rescue-case-desc">{caseItem.description}</p>
                    </div>
                    <div className="rescue-case-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label="View case location on map"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMapCase(caseItem);
                        }}
                      >
                        <MapPin size={18} />
                      </button>
                      <button
                        className="overview-btn-filled"
                        type="button"
                        disabled={acceptingId === caseItem.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAcceptCase(caseItem.id);
                        }}
                      >
                        {acceptingId === caseItem.id ? "Accepting..." : "Accept Case"}
                      </button>
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
          <Link className="inline-link" to="/dashboard/workflow/under-care">Show More Animals &gt;</Link>
        </div>
        <div className="under-care-grid">
          {visibleAnimals.length ? visibleAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              compact
              footer={
                <Link className="am-public-link" to={`/animals/${animal.id}`}>
                  <ExternalLink size={14} /> View Profile
                </Link>
              }
            />
          )) : <div className="empty-state">No active animal profiles under care yet.</div>}
        </div>
      </section>

      {mapCase ? (
        <CaseLocationModal
          caseId={mapCase.id}
          description={mapCase.description}
          latitude={mapCase.latitude}
          longitude={mapCase.longitude}
          onClose={() => setMapCase(null)}
        />
      ) : null}
    </div>
  );
}

export default Dashboard;
