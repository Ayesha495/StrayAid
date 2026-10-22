import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Clock, Columns3, FileText, Inbox, Lightbulb, MessageSquare, X, XCircle } from "lucide-react";
import { decideApplication, getApplications } from "../services/fundingService";
import { startConversation } from "../services/chatService";
import { useApi } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import FilterTiles from "../ui/FilterTiles";
import Avatar from "../ui/Avatar";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, LoadingRows } from "../ui/States";
import { formatDate } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import type { AdoptionApplication } from "../types/api";
import "./Applications.css";

const FILTERS = [
  { key: "pending", label: "Pending", hint: "waiting on you", icon: <Clock size={16} />, tint: "amber" },
  { key: "approved", label: "Approved", hint: "going home", icon: <CheckCircle2 size={16} />, tint: "green" },
  { key: "rejected", label: "Declined", hint: "not this time", icon: <XCircle size={16} />, tint: "coral" },
  { key: "all", label: "All", hint: "every application", icon: <Inbox size={16} />, tint: "blue" },
] as const;

const HOME = { apartment: "Apartment", house: "House", other: "Other" };
const EXPERIENCE = { first_time: "First pet", some: "Had pets before", experienced: "Very experienced", "": "Not said" };

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? "Not said" : value ? "Yes" : "No");

/** The answers organizations compare, in the order of the application form. */
const FACTS: Array<[label: string, read: (application: AdoptionApplication) => string]> = [
  ["City", (a) => a.city || "Not said"],
  ["Home", (a) => HOME[a.home_type] ?? a.home_type],
  ["Owns or rents", (a) => (a.ownership === "own" ? "Owns" : a.ownership === "rent" ? `Rents${a.landlord_allows_pets === null ? "" : a.landlord_allows_pets ? " (pets allowed)" : " (pets not allowed)"}` : "Not said")],
  ["Household", (a) => (a.household_size ? `${a.household_size} ${a.household_size === 1 ? "person" : "people"}` : "Not said")],
  ["Children", (a) => yesNo(a.has_children)],
  ["Other pets", (a) => yesNo(a.has_other_pets)],
  ["Alone per day", (a) => (a.hours_alone === null ? "Not said" : `${a.hours_alone} h`)],
  ["Experience", (a) => EXPERIENCE[a.experience] ?? a.experience],
  ["Home visit OK", (a) => yesNo(a.agrees_home_visit)],
  ["Return policy OK", (a) => yesNo(a.agrees_return_policy)],
];

type Group = { animal: AdoptionApplication["animal"]; applications: AdoptionApplication[] };

function groupByAnimal(applications: AdoptionApplication[]): Group[] {
  const groups = new Map<number, Group>();
  applications.forEach((application) => {
    const group = groups.get(application.animal.id) ?? { animal: application.animal, applications: [] };
    group.applications.push(application);
    groups.set(application.animal.id, group);
  });
  return [...groups.values()];
}

function CompareDialog({ group, onClose, onPick }: { group: Group; onClose: () => void; onPick: (id: number) => void }) {
  return (
    <Modal wide title={`Compare applicants for ${group.animal.name}`} onClose={onClose}>
      <div className="table-wrap">
        <table className="table compare-table">
          <thead>
            <tr>
              <th />
              {group.applications.map((application) => (
                <th key={application.id}>
                  <button type="button" className="link" onClick={() => onPick(application.id)}>{application.full_name}</button>
                  <div><StatusChip kind="review" value={application.status} /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FACTS.map(([label, read]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {group.applications.map((application) => <td key={application.id}>{read(application)}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row">Applied</th>
              {group.applications.map((application) => <td key={application.id}>{formatDate(application.created_at)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function DecisionDialog({ application, decision, otherPending, onCancel, onConfirm }: {
  application: AdoptionApplication;
  decision: "approved" | "rejected";
  otherPending: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const approving = decision === "approved";
  return (
    <Modal
      title={approving ? `Approve ${application.full_name}?` : `Decline ${application.full_name}?`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={`btn ${approving ? "btn-primary" : "btn-danger"}`}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : approving ? "Approve adoption" : "Decline application"}
          </button>
        </>
      }
    >
      {approving ? (
        <ul className="decision-effects">
          <li>{application.animal.name} will be marked <strong>adopted</strong> and the rescue case closes.</li>
          {otherPending ? <li>The other {otherPending} pending application{otherPending === 1 ? " is" : "s are"} declined automatically.</li> : null}
          <li>{application.full_name} is notified so you can arrange the visit.</li>
        </ul>
      ) : (
        <p>{application.full_name} will be told the application wasn't approved this time.</p>
      )}
    </Modal>
  );
}

function ApplicationDetail({ application, onDecide, onMessage, messaging, onBack }: {
  application: AdoptionApplication;
  onDecide: (decision: "approved" | "rejected") => void;
  onMessage: () => void;
  messaging: boolean;
  onBack: () => void;
}) {
  return (
    <section className="card app-detail" aria-label="Application">
      <div className="card-header">
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <button type="button" className="sa-icon-btn app-back" aria-label="Back to list" onClick={onBack}><ArrowLeft size={18} /></button>
          <Avatar name={application.full_name} size={40} />
          <div style={{ minWidth: 0 }}>
            <h3 className="truncate">{application.full_name}</h3>
            <div className="small muted">
              Wants to adopt <Link className="link" to={`/animals/${application.animal.id}`}>{application.animal.name}</Link> · applied {formatRelativeTime(application.created_at)}
            </div>
          </div>
        </div>
        <StatusChip kind="review" value={application.status} />
      </div>

      <div className="card-body stack" style={{ gap: 20 }}>
        <dl className="app-facts">
          <div><dt>Phone</dt><dd><a className="link" href={`tel:${application.phone}`}>{application.phone}</a></dd></div>
          {FACTS.map(([label, read]) => (
            <div key={label}><dt>{label}</dt><dd>{read(application)}</dd></div>
          ))}
        </dl>

        <div>
          <h4>Why they want to adopt</h4>
          <p className="app-answer">{application.reason || "No answer given."}</p>
        </div>
        <div>
          <h4>Care plan</h4>
          <p className="app-answer">{application.care_plan || "No answer given."}</p>
        </div>
        {application.decided_at ? <p className="small muted">Decided on {formatDate(application.decided_at)}.</p> : null}
      </div>

      <div className="app-actions">
        <button type="button" className="btn btn-secondary" onClick={onMessage} disabled={messaging}>
          <MessageSquare size={16} /> {messaging ? "Opening…" : "Message applicant"}
        </button>
        {application.status === "pending" ? (
          <>
            <button type="button" className="btn btn-danger-outline" onClick={() => onDecide("rejected")}><X size={16} /> Decline</button>
            <button type="button" className="btn btn-primary" onClick={() => onDecide("approved")}><Check size={16} /> Approve</button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Applications() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const applications = useApi(() => getApplications());
  // Opened from an animal's profile: only that animal's applicants, every status.
  const animalId = Number(params.get("animal")) || null;
  const [filter, setFilter] = useState(params.get("application") || animalId ? "all" : "pending");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [comparing, setComparing] = useState<Group | null>(null);
  const [messaging, setMessaging] = useState(false);

  const all = useMemo(
    () => (applications.data ?? []).filter((item) => !animalId || item.animal.id === animalId),
    [applications.data, animalId],
  );
  const scopedAnimal = animalId ? all[0]?.animal ?? null : null;
  const visible = useMemo(() => all.filter((item) => filter === "all" || item.status === filter), [all, filter]);
  const groups = useMemo(() => groupByAnimal(visible), [visible]);
  const selectedId = Number(params.get("application")) || null;
  const selected = all.find((item) => item.id === selectedId) ?? null;

  const select = (id: number | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set("application", String(id));
        else next.delete("application");
        return next;
      },
      { replace: true },
    );

  const decide = async () => {
    if (!selected || !decision) return;
    try {
      await decideApplication(selected.id, decision);
      toast({
        title: decision === "approved" ? `${selected.animal.name} is adopted!` : "Application declined",
        body: decision === "approved" ? `${selected.full_name} has been told. Other applicants were notified.` : `${selected.full_name} has been told.`,
      });
      setDecision(null);
      applications.reload();
    } catch (error) {
      toast({ title: "Couldn't save the decision", body: errorMessage(error), tone: "error" });
    }
  };

  const message = async () => {
    if (!selected) return;
    setMessaging(true);
    try {
      const conversation = await startConversation({ application_id: selected.id });
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      toast({ title: "Couldn't open the chat", body: errorMessage(error), tone: "error" });
      setMessaging(false);
    }
  };

  const otherPending = selected ? all.filter((item) => item.animal.id === selected.animal.id && item.status === "pending" && item.id !== selected.id).length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{scopedAnimal ? `Applications for ${scopedAnimal.name}` : "Adoption applications"}</h1>
          <p>
            {scopedAnimal
              ? `Everyone who asked to adopt ${scopedAnimal.name}. Compare them before you decide.`
              : "Review people who want to adopt your animals. Compare applicants before you decide."}
          </p>
        </div>
        {animalId ? (
          <div className="page-actions">
            <Link to={`/animals/${animalId}`} className="btn btn-secondary">View {scopedAnimal?.name ?? "animal"}</Link>
            <Link to="/applications" className="btn btn-secondary">All animals</Link>
          </div>
        ) : null}
      </div>

      <FilterTiles
        label="Application status"
        value={filter}
        onChange={setFilter}
        tiles={FILTERS.map((entry) => ({ ...entry, count: all.filter((item) => entry.key === "all" || item.status === entry.key).length }))}
      />

      <div className={`app-layout${selected ? " has-selection" : ""}`}>
        <div className="app-list">
          {applications.loading && !applications.data ? (
            <LoadingRows rows={4} height={80} />
          ) : applications.error && !applications.data ? (
            <ErrorState message={errorMessage(applications.error)} onRetry={applications.reload} />
          ) : groups.length ? (
            groups.map((group) => (
              <section className="card app-group" key={group.animal.id}>
                <header className="app-group-head">
                  <span className="app-group-photo">{group.animal.image ? <img src={group.animal.image} alt="" /> : null}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="strong">{group.animal.name}</div>
                    <div className="small muted">{group.applications.length} applicant{group.applications.length === 1 ? "" : "s"}</div>
                  </div>
                  {group.applications.length > 1 ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setComparing(group)}>
                      <Columns3 size={14} /> Compare
                    </button>
                  ) : null}
                </header>
                <ul className="app-rows">
                  {group.applications.map((application) => (
                    <li key={application.id}>
                      <button type="button" className={`app-row${application.id === selectedId ? " is-selected" : ""}`} onClick={() => select(application.id)}>
                        <Avatar name={application.full_name} size={32} />
                        <span className="app-row-text">
                          <span className="strong truncate">{application.full_name}</span>
                          <span className="small muted truncate">
                            {[application.city, HOME[application.home_type], formatRelativeTime(application.created_at)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <StatusChip kind="review" value={application.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <EmptyState
              icon={<FileText size={22} />}
              title={filter === "pending" ? "No applications waiting" : "No applications here"}
              message="When people apply to adopt one of your adoptable animals, they show up here."
            />
          )}
        </div>

        <div className="app-detail-pane">
          {selected ? (
            <ApplicationDetail
              application={selected}
              onDecide={setDecision}
              onMessage={message}
              messaging={messaging}
              onBack={() => select(null)}
            />
          ) : (
            <div className="card app-guide">
              <span className="app-guide-icon"><Lightbulb size={18} /></span>
              <h3>Pick an applicant to read their answers</h3>
              <p className="muted">A few things rescue teams look for:</p>
              <ul>
                <li><strong>Home fit.</strong> Space, landlord permission and how long the animal would be alone.</li>
                <li><strong>Experience.</strong> First-time adopters can be great; they may just need more guidance.</li>
                <li><strong>Commitment.</strong> Agreeing to a home visit and the return policy.</li>
              </ul>
              <p className="small muted">With more than one applicant, use <strong>Compare</strong> to see their answers side by side.</p>
            </div>
          )}
        </div>
      </div>

      {comparing ? (
        <CompareDialog
          group={comparing}
          onClose={() => setComparing(null)}
          onPick={(id) => {
            setComparing(null);
            select(id);
          }}
        />
      ) : null}
      {selected && decision ? (
        <DecisionDialog application={selected} decision={decision} otherPending={otherPending} onCancel={() => setDecision(null)} onConfirm={decide} />
      ) : null}
    </div>
  );
}

export default Applications;
