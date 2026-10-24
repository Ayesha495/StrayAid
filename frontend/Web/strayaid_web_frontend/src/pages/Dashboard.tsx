import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Download, Folder, HeartHandshake, MapPin, PawPrint, Plus } from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import ConcentricRingChart from "../components/ConcentricRingChart";
import CasesTrendChart from "../components/CasesTrendChart";
import CaseLocationModal from "../components/CaseLocationModal";
import CasesMap from "../components/CasesMap";
import { acceptCase, getCases, getDashboard, getOrganizationAnimals, getOrganizationProfile } from "../services/platformService";
import type { Animal, Case, DashboardData, Organization } from "../types/platform";
import { formatRelativeTime, minutesSince } from "../utils/time";
import "../styles/Portal.css";
import "../styles/Dashboard.css";

type ActivityFilter = "all" | "rescues" | "updates";

// One colour per stage, shared by the rings, the trend lines and the workflow dots
// (validated for colour-blind separation; mirrors --series-* in tokens.css).
const TREND_DAYS = 30;
const SERIES = { reported: "#3b6fd0", active: "#c27a12", rescued: "#16946a", adopted: "#7d5bd0" };

function pct(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalPreviewCount, setAnimalPreviewCount] = useState(4);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
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
    getOrganizationProfile()
      .then((profile) => {
        setOrganization(profile);
        setNeedsProfile(false);
      })
      .catch(() => setNeedsProfile(true));
    loadCasesAndDashboard();
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  useEffect(() => {
    const syncAnimalPreviewCount = () => {
      setAnimalPreviewCount(window.innerWidth >= 1500 ? 4 : 3);
    };

    syncAnimalPreviewCount();
    window.addEventListener("resize", syncAnimalPreviewCount);
    return () => window.removeEventListener("resize", syncAnimalPreviewCount);
  }, []);

  const reportedCount = useMemo(() => cases.filter((caseItem) => caseItem.status === "reported").length, [cases]);

  const unclaimedCases = useMemo(() => {
    return cases
      .filter((caseItem) => !caseItem.organization && caseItem.status === "reported")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [cases]);
  const openRescueCases = unclaimedCases.slice(0, 4);

  const trendChart = useMemo(() => {
    const dayKeys: string[] = [];
    const labels: string[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
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
        { label: "Reported", color: SERIES.reported, values: reported },
        { label: "Active", color: SERIES.active, values: active },
        { label: "Rescued", color: SERIES.rescued, values: rescued },
        { label: "Adopted", color: SERIES.adopted, values: adopted },
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
        <div className="dash-empty">
          <h1>Complete your organization profile first</h1>
          <p>Your dashboard unlocks once your rescue organization details are saved.</p>
          <Link className="primary-btn" to="/organization/register">Create organization profile</Link>
        </div>
      </div>
    );
  }

  const summary = dashboard?.summary;

  return (
    <div className="portal-page overview-page">
      <header className="overview-header">
        <div>
          <h1>Overview</h1>
          <p className="overview-subtitle">What's happening across your rescue area today.</p>
        </div>
        <div className="overview-actions">
          <button className="secondary-btn" type="button" onClick={handleExportReport}>
            <Download size={15} /> Export CSV
          </button>
          <Link className="primary-btn" to="/animals/manage">
            <Plus size={15} /> New animal
          </Link>
        </div>
      </header>

      {summary ? (
        <>
          <dl className="stat-strip">
            <div className="stat-strip-item is-blue">
              <dt><span className="stat-strip-icon"><Folder size={14} /></span>Total cases</dt>
              <dd>{summary.total_cases}</dd>
            </div>
            <div className="stat-strip-item is-amber">
              <dt><span className="stat-strip-icon"><Activity size={14} /></span>Active rescues</dt>
              <dd>{summary.active_cases}<small>{reportedCount} waiting</small></dd>
            </div>
            <div className="stat-strip-item is-green">
              <dt><span className="stat-strip-icon"><PawPrint size={14} /></span>Animals under care</dt>
              <dd>{summary.animals_count}</dd>
            </div>
            <div className="stat-strip-item is-purple">
              <dt><span className="stat-strip-icon"><HeartHandshake size={14} /></span>Successful adoptions</dt>
              <dd>{summary.adoption_cases}</dd>
            </div>
          </dl>

          <div className="overview-charts">
            <section aria-labelledby="dash-status">
              <div className="section-heading">
                <div>
                  <h2 id="dash-status">Case status</h2>
                  <p className="meta-line">Share of all cases at each stage.</p>
                </div>
              </div>
              <ConcentricRingChart
                centerValue={String(summary.total_cases)}
                centerLabel="cases"
                rings={[
                  { label: "Reported", value: pct(reportedCount, summary.total_cases), color: SERIES.reported },
                  { label: "Active", value: pct(summary.active_cases, summary.total_cases), color: SERIES.active },
                  { label: "Rescued", value: pct(summary.rescued_cases, summary.total_cases), color: SERIES.rescued },
                  { label: "Adopted", value: pct(summary.adoption_cases, summary.total_cases), color: SERIES.adopted },
                ]}
              />
            </section>
            <section aria-labelledby="dash-activity">
              <div className="section-heading">
                <div>
                  <h2 id="dash-activity">Case activity</h2>
                  <p className="meta-line">New cases per day by stage, last 30 days.</p>
                </div>
              </div>
              <CasesTrendChart labels={trendChart.labels} series={trendChart.series} />
            </section>
          </div>
        </>
      ) : null}

      <div className="overview-split">
        <section className="overview-rescue-board" aria-labelledby="dash-waiting">
          <div className="section-heading">
            <div>
              <h2 id="dash-waiting">Waiting for a team</h2>
              <p className="meta-line">Unclaimed reports, oldest first.</p>
            </div>
            <Link className="inline-link" to="/cases">All cases</Link>
          </div>

          {openRescueCases.length ? (
            <ul className="rescue-board-list">
              {openRescueCases.map((caseItem) => {
                const elapsedMinutes = minutesSince(caseItem.created_at);
                const isHighPriority = elapsedMinutes > 120;

                return (
                  <li className="rescue-case-row" key={caseItem.id}>
                    <Link className="rescue-case-content" to={`/cases/${caseItem.id}`}>
                      <div className="rescue-case-id-row">
                        <span className="rescue-case-number">Case #R-{caseItem.id}</span>
                        <span className={`priority-tag ${isHighPriority ? "priority-high" : "priority-medium"}`}>
                          {isHighPriority ? "High priority" : "Medium"}
                        </span>
                      </div>
                      <p className="rescue-case-desc">{caseItem.description}</p>
                      <p className="meta-line">
                        {formatRelativeTime(caseItem.created_at)}
                        {caseItem.distance_km != null ? <> &middot; {caseItem.distance_km.toFixed(1)} km away</> : null}
                      </p>
                    </Link>
                    <div className="rescue-case-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`Show case ${caseItem.id} on a map`}
                        title="Show on map"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMapCase(caseItem);
                        }}
                      >
                        <MapPin size={15} />
                      </button>
                      <button
                        className="primary-btn"
                        type="button"
                        disabled={acceptingId === caseItem.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAcceptCase(caseItem.id);
                        }}
                      >
                        {acceptingId === caseItem.id ? "Accepting…" : "Accept"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">No unclaimed cases waiting right now.</p>
          )}
        </section>

        <section className="overview-map" aria-labelledby="dash-map">
          <div className="section-heading">
            <div>
              <h2 id="dash-map">Open reports map</h2>
              <p className="meta-line">Pins by severity, with your base and service area.</p>
            </div>
            <span className="badge badge-blue">{unclaimedCases.length} open</span>
          </div>
          <div className="location-map-shell">
            <CasesMap cases={unclaimedCases} organization={organization} className="location-map overview-map-canvas" />
          </div>
        </section>
      </div>

      <div className="overview-split overview-split-lower">
        <section aria-labelledby="dash-animals">
          <div className="section-heading">
            <div>
              <h2 id="dash-animals">Animals under care</h2>
              <p className="meta-line">Recovering and adoptable animals with your team.</p>
            </div>
            <Link className="inline-link inline-link-arrow" to="/dashboard/workflow/under-care">
              See all <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          {visibleAnimals.length ? (
            <div className="under-care-grid">
              {visibleAnimals.map((animal) => (
                <AnimalCard
                  key={animal.id}
                  animal={animal}
                  compact
                  footer={<Link className="am-public-link" to={`/animals/${animal.id}`}>View profile</Link>}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No active animal profiles under care yet.</p>
          )}
        </section>

        <section className="overview-activity" aria-labelledby="dash-recent">
          <div className="section-heading">
            <h2 id="dash-recent">Recent activity</h2>
          </div>
          <div className="tabs activity-tabs" role="tablist" aria-label="Filter activity">
            {(["all", "rescues", "updates"] as ActivityFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className="tab"
                aria-selected={activityFilter === tab}
                onClick={() => setActivityFilter(tab)}
              >
                {tab === "all" ? "All" : tab === "rescues" ? "Rescues" : "Updates"}
              </button>
            ))}
          </div>
          {activityItems.length ? (
            <ol className="activity-list">
              {activityItems.map((caseItem) => {
                const isRescued = caseItem.status === "rescued";
                const isInProgress = ["assigned", "in_progress"].includes(caseItem.status);
                const tone = isRescued ? "rescued" : isInProgress ? "active" : "reported";

                return (
                  <li className="activity-item" key={caseItem.id}>
                    <span className={`activity-dot activity-dot-${tone}`} aria-hidden="true" />
                    <div>
                      <p className="activity-text">
                        <Link to={`/cases/${caseItem.id}`}>Case #R-{caseItem.id}</Link>{" "}
                        {isRescued ? "marked as rescued" : isInProgress ? "is in progress" : `filed as ${caseItem.status}`}
                      </p>
                      <p className="meta-line">{formatRelativeTime(caseItem.updated_at)} &middot; {caseItem.organization?.name || "Unassigned"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="empty-state">No recent activity yet.</p>
          )}
        </section>
      </div>

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
