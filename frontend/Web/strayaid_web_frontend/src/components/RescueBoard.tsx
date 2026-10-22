import { Link } from "react-router-dom";
import { Clock, Home, Inbox, Mail, Navigation, Stethoscope, Truck } from "lucide-react";
import type { ReactNode } from "react";
import type { Animal, Case, Organization, Report } from "../types/platform";
import ScoreBadge from "../ui/ScoreBadge";
import CasesMap from "./CasesMap";
import { byScore } from "../utils/cases";
import { formatRelativeTime } from "../utils/time";
import { formatDuration } from "../utils/format";
import "../styles/CasesWorkflow.css";

type RescueBoardProps = {
  cases: Case[];
  animals?: Animal[];
  heading?: string;
  copy?: string;
  organization?: Organization | null;
};

type Kpi = {
  key: string;
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: "blue" | "amber" | "green" | "purple" | "coral";
};

function daysInCare(dateString: string): number {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function reporterLabel(report?: Report): string {
  if (!report) {
    return "";
  }
  return report.user_email && report.user_email.trim() ? report.user_email : "Anonymous report";
}

function RescueBoard({ cases, animals = [], heading = "Case Management", copy, organization }: RescueBoardProps) {
  // Highest AI priority first, so the most urgent reports are at the top.
  const reportedCases = cases.filter((caseItem) => !caseItem.organization && caseItem.status === "reported").sort(byScore);
  const inProgressCases = cases.filter(
    (caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status)
  );
  const rescuedAnimals = animals.filter((animal) => ["rescued", "recovering"].includes(animal.status));
  const adoptionAnimals = animals.filter((animal) => animal.status === "adoptable");
  const previewItems = <T,>(items: T[]) => items.slice(0, 3);

  const claimedCases = cases.filter((caseItem) => Boolean(caseItem.organization) && caseItem.status !== "reported");
  const avgResponseMinutes = claimedCases.length
    ? claimedCases.reduce((total, caseItem) => {
        const created = new Date(caseItem.created_at).getTime();
        const updated = new Date(caseItem.updated_at).getTime();
        return total + (updated - created) / 60000;
      }, 0) / claimedCases.length
    : null;
  const avgResponseLabel = avgResponseMinutes === null ? "N/A" : formatDuration(avgResponseMinutes);

  const kpis: Kpi[] = [
    { key: "pending", label: "Waiting for a team", value: reportedCases.length, icon: <Inbox size={14} />, tone: "blue" },
    { key: "transit", label: "On the way", value: inProgressCases.length, icon: <Truck size={14} />, tone: "amber" },
    { key: "clinic", label: "In recovery", value: rescuedAnimals.length, icon: <Stethoscope size={14} />, tone: "green" },
    { key: "adoption", label: "Ready for adoption", value: adoptionAnimals.length, icon: <Home size={14} />, tone: "purple" },
    { key: "response", label: "Average response", value: avgResponseLabel, icon: <Clock size={14} />, tone: "blue" },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{heading}</h1>
          <p>{copy || "Monitor open reports, active rescues, and the animals currently moving through care and adoption."}</p>
        </div>
      </div>

      <dl className="stat-strip">
        {kpis.map((kpi) => (
          <div className={`stat-strip-item is-${kpi.tone}`} key={kpi.key}>
            <dt><span className="stat-strip-icon">{kpi.icon}</span>{kpi.label}</dt>
            <dd>{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Reported cases map</h2>
            <p className="meta-line">Reports still waiting for a rescue team, coloured by severity.</p>
          </div>
          <span className="badge badge-blue">{reportedCases.length} open</span>
        </div>
        <div className="location-map-shell">
          <CasesMap cases={reportedCases} organization={organization} />
        </div>
        <p className="map-footnote">
          <Navigation size={14} /> {reportedCases.length} pending pickup
        </p>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Rescue workflow</h2>
            <p className="meta-line">Every case and animal, from first report to adoption.</p>
          </div>
        </div>

        <div className="workflow-grid">
          <div className="category-panel category-panel-blue">
            <div className="category-header">
              <h3 className="stage-title stage-blue">Reported</h3>
              <span className="stage-count">{reportedCases.length}</span>
            </div>
            {previewItems(reportedCases).length ? previewItems(reportedCases).map((caseItem) => {
              const report = caseItem.reports[0];
              return (
                <Link className="status-card status-card-blue" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                  <strong>Case #{caseItem.id}</strong> <ScoreBadge score={caseItem.confidence_score} compact />
                  <p>{caseItem.description}</p>
                  <p className="status-card-meta">Reported {formatRelativeTime(caseItem.created_at)}</p>
                  {report ? (
                    <p className="status-card-meta">
                      <Mail size={12} /> {reporterLabel(report)}
                    </p>
                  ) : null}
                </Link>
              );
            }) : <div className="empty-state compact-state">No unclaimed reported cases.</div>}
            {reportedCases.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/reported">More reported cases</Link> : null}
          </div>

          <div className="category-panel category-panel-amber">
            <div className="category-header">
              <h3 className="stage-title stage-amber">In progress</h3>
              <span className="stage-count">{inProgressCases.length}</span>
            </div>
            {previewItems(inProgressCases).length ? previewItems(inProgressCases).map((caseItem) => {
              const report = caseItem.reports[0];
              return (
                <Link className="status-card status-card-amber" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                  <strong>Case #{caseItem.id}</strong>
                  <p>{caseItem.description}</p>
                  <p className="status-card-meta">Updated {formatRelativeTime(caseItem.updated_at)}</p>
                  {report ? (
                    <p className="status-card-meta">
                      <Mail size={12} /> {reporterLabel(report)}
                    </p>
                  ) : null}
                </Link>
              );
            }) : <div className="empty-state compact-state">No active rescue cases right now.</div>}
            {inProgressCases.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/in-progress">More in progress</Link> : null}
          </div>

          <div className="category-panel category-panel-green">
            <div className="category-header">
              <h3 className="stage-title stage-green">Rescued</h3>
              <span className="stage-count">{rescuedAnimals.length}</span>
            </div>
            {previewItems(rescuedAnimals).length ? previewItems(rescuedAnimals).map((animal) => {
              const days = daysInCare(animal.created_at);
              return (
                <Link className="status-card status-card-green" key={animal.id} to={`/animals/${animal.id}`}>
                  <strong>{animal.name}</strong>
                  <p>{animal.description || "Animal profile ready for care updates."}</p>
                  <p className="status-card-meta">
                    {days === 0 ? "Added today" : `${days} day${days === 1 ? "" : "s"} in care`}
                  </p>
                </Link>
              );
            }) : <div className="empty-state compact-state">No rescued animal profiles yet.</div>}
            {rescuedAnimals.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/rescued">More rescued animals</Link> : null}
          </div>

          <div className="category-panel category-panel-purple">
            <div className="category-header">
              <h3 className="stage-title stage-purple">Up for adoption</h3>
              <span className="stage-count">{adoptionAnimals.length}</span>
            </div>
            {previewItems(adoptionAnimals).length ? previewItems(adoptionAnimals).map((animal) => (
              <Link className="status-card status-card-purple" key={animal.id} to={`/animals/${animal.id}`}>
                <strong>{animal.name}</strong>
                <p>{animal.description || "Ready for sponsors and adopters."}</p>
                <p className="status-card-meta">Listed {formatRelativeTime(animal.created_at)}</p>
              </Link>
            )) : <div className="empty-state compact-state">No animals are up for adoption yet.</div>}
            {adoptionAnimals.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/adoptable">More adoptable animals</Link> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RescueBoard;
