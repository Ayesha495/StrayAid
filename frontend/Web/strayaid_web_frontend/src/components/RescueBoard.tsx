import { useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Home, Inbox, Mail, Navigation, Stethoscope, Truck } from "lucide-react";
import type { ReactNode } from "react";
import type { Animal, Case, Organization, Report } from "../types/platform";
import ScoreBadge from "../ui/ScoreBadge";
import CasesMap from "./CasesMap";
import { byScore } from "../utils/cases";
import { formatRelativeTime } from "../utils/time";
import { formatDuration } from "../utils/format";
import { acceptCase, updateAnimal, updateCaseStatus } from "../services/platformService";
import { useToast } from "../ui/Toast";
import { errorMessage } from "../utils/errors";
// The board's columns and map shell live in Portal.css; import it here so /cases is styled
// even when it's the first page opened (not only after visiting the dashboard).
import "../styles/Portal.css";
import "../styles/CasesWorkflow.css";

type RescueBoardProps = {
  cases: Case[];
  animals?: Animal[];
  heading?: string;
  copy?: string;
  organization?: Organization | null;
  /** Called after a card is moved, so the page can load the new state. */
  onChange?: () => void;
};

type Column = "reported" | "progress" | "rescued" | "adoption";
type Dragged = { kind: "case" | "animal"; id: number; from: Column; name: string };

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

function RescueBoard({ cases, animals = [], heading = "Case Management", copy, organization, onChange }: RescueBoardProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [moving, setMoving] = useState(false);

  // Highest AI priority first, so the most urgent reports are at the top.
  const reportedCases = cases.filter((caseItem) => !caseItem.organization && caseItem.status === "reported").sort(byScore);
  const inProgressCases = cases.filter(
    (caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status)
  );
  // A case marked rescued stays in "Rescued" as a card until its animal profile is created.
  const rescuedCases = cases.filter((caseItem) => Boolean(caseItem.organization) && caseItem.status === "rescued" && !caseItem.animal_profile);
  const rescuedAnimals = animals.filter((animal) => ["rescued", "recovering"].includes(animal.status));
  const rescuedCount = rescuedCases.length + rescuedAnimals.length;
  const adoptionAnimals = animals.filter((animal) => animal.status === "adoptable");
  const previewItems = <T,>(items: T[]) => items.slice(0, 3);

  const refuse = (title: string, body: string, link?: { to: string; label: string }) => toast({ title, body, tone: "error", link });

  /** Dropping a card on a column asks the server for the matching status change; the server's own rules decide. */
  const drop = async (target: Column) => {
    const item = dragged;
    setDragged(null);
    setOver(null);
    if (!item || item.from === target || moving) return;
    setMoving(true);
    try {
      if (item.kind === "case") {
        if (item.from === "reported" && target === "progress") {
          await acceptCase(item.id);
          toast({ title: `${item.name} accepted`, body: "It's yours now. Update its status as the rescue moves on." });
        } else if (item.from === "reported") {
          refuse("Accept the case first", "A report has to be accepted by your team before it can move further.");
          return;
        } else if (target === "reported") {
          refuse("Can't go back to Reported", "A case your team has accepted stays with your team.");
          return;
        } else if (target === "rescued") {
          await updateCaseStatus(item.id, "rescued");
          toast({ title: `${item.name} marked rescued`, body: "Add the animal's profile so it can be cared for and listed.", link: { to: `/animals/manage?caseId=${item.id}`, label: "Create profile" } });
        } else if (target === "progress") {
          await updateCaseStatus(item.id, "in_progress");
          toast({ title: `${item.name} is back in progress` });
        } else {
          // Listing for adoption needs an animal profile, so go and make it.
          navigate(`/animals/manage?caseId=${item.id}`);
          toast({ title: "Create the animal's profile first", body: "Once it's saved and ready, you can list the animal for adoption." });
          return;
        }
      } else if (target === "reported" || target === "progress") {
        refuse("Animals don't move back to cases", "Animals move between Rescued and Up for adoption.");
        return;
      } else if (target === "adoption") {
        await updateAnimal(item.id, { status: "adoptable" });
        toast({ title: `${item.name} is up for adoption`, body: "Adopters and sponsors can see the profile now." });
      } else {
        await updateAnimal(item.id, { status: "recovering", status_note: "Moved back to recovery from the rescue board." });
        toast({ title: `${item.name} is back in recovery` });
      }
      onChange?.();
    } catch (error) {
      refuse(`Couldn't move ${item.name}`, errorMessage(error));
    } finally {
      setMoving(false);
    }
  };

  const dragProps = (item: Dragged) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.name);
      setDragged(item);
    },
    onDragEnd: () => {
      setDragged(null);
      setOver(null);
    },
  });

  const columnProps = (column: Column) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = dragged.from === column ? "none" : "move";
      if (over !== column) setOver(column);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver((current) => (current === column ? null : current));
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      void drop(column);
    },
  });

  const panelClass = (column: Column, tone: string) =>
    `category-panel category-panel-${tone}${over === column && dragged && dragged.from !== column ? " is-drop-target" : ""}${dragged ? " is-dragging-over-board" : ""}`;
  const cardClass = (item: Dragged) => `status-card${dragged && dragged.kind === item.kind && dragged.id === item.id ? " is-dragged" : ""}`;

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
    { key: "clinic", label: "In recovery", value: rescuedCount, icon: <Stethoscope size={14} />, tone: "green" },
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

        <p className="workflow-hint">Drag a card to another column to change its status.</p>
        <div className="workflow-grid">
          <div className={panelClass("reported", "blue")} {...columnProps("reported")}>
            <div className="category-header">
              <h3 className="stage-title stage-blue">Reported</h3>
              <span className="stage-count">{reportedCases.length}</span>
            </div>
            {previewItems(reportedCases).length ? previewItems(reportedCases).map((caseItem) => {
              const report = caseItem.reports[0];
              const item: Dragged = { kind: "case", id: caseItem.id, from: "reported", name: `Case #${caseItem.id}` };
              return (
                <Link className={cardClass(item)} key={caseItem.id} to={`/cases/${caseItem.id}`} {...dragProps(item)}>
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

          <div className={panelClass("progress", "amber")} {...columnProps("progress")}>
            <div className="category-header">
              <h3 className="stage-title stage-amber">In progress</h3>
              <span className="stage-count">{inProgressCases.length}</span>
            </div>
            {previewItems(inProgressCases).length ? previewItems(inProgressCases).map((caseItem) => {
              const report = caseItem.reports[0];
              const item: Dragged = { kind: "case", id: caseItem.id, from: "progress", name: `Case #${caseItem.id}` };
              return (
                <Link className={cardClass(item)} key={caseItem.id} to={`/cases/${caseItem.id}`} {...dragProps(item)}>
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

          <div className={panelClass("rescued", "green")} {...columnProps("rescued")}>
            <div className="category-header">
              <h3 className="stage-title stage-green">Rescued</h3>
              <span className="stage-count">{rescuedCount}</span>
            </div>
            {rescuedCount ? (
              <>
                {rescuedCases.slice(0, 3).map((caseItem) => {
                  const item: Dragged = { kind: "case", id: caseItem.id, from: "rescued", name: `Case #${caseItem.id}` };
                  return (
                    <Link className={cardClass(item)} key={`case-${caseItem.id}`} to={`/cases/${caseItem.id}`} {...dragProps(item)}>
                      <strong>Case #{caseItem.id}</strong>
                      <p>{caseItem.description}</p>
                      <p className="status-card-meta">Rescued · animal profile needed</p>
                    </Link>
                  );
                })}
                {rescuedAnimals.slice(0, Math.max(0, 3 - rescuedCases.length)).map((animal) => {
                  const days = daysInCare(animal.created_at);
                  const item: Dragged = { kind: "animal", id: animal.id, from: "rescued", name: animal.name };
                  return (
                    <Link className={cardClass(item)} key={animal.id} to={`/animals/${animal.id}/manage`} {...dragProps(item)}>
                      <strong>{animal.name}</strong>
                      <p>{animal.description || "Animal profile ready for care updates."}</p>
                      <p className="status-card-meta">
                        {days === 0 ? "Added today" : `${days} day${days === 1 ? "" : "s"} in care`}
                      </p>
                    </Link>
                  );
                })}
              </>
            ) : <div className="empty-state compact-state">No rescued animal profiles yet.</div>}
            {rescuedCount > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/rescued">More rescued animals</Link> : null}
          </div>

          <div className={panelClass("adoption", "purple")} {...columnProps("adoption")}>
            <div className="category-header">
              <h3 className="stage-title stage-purple">Up for adoption</h3>
              <span className="stage-count">{adoptionAnimals.length}</span>
            </div>
            {previewItems(adoptionAnimals).length ? previewItems(adoptionAnimals).map((animal) => {
              const item: Dragged = { kind: "animal", id: animal.id, from: "adoption", name: animal.name };
              return (
                <Link className={cardClass(item)} key={animal.id} to={`/animals/${animal.id}/manage`} {...dragProps(item)}>
                  <strong>{animal.name}</strong>
                  <p>{animal.description || "Ready for sponsors and adopters."}</p>
                  <p className="status-card-meta">Listed {formatRelativeTime(animal.created_at)}</p>
                </Link>
              );
            }) : <div className="empty-state compact-state">No animals are up for adoption yet.</div>}
            {adoptionAnimals.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/adoptable">More adoptable animals</Link> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RescueBoard;
