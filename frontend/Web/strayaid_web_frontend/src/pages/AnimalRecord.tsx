import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Cake,
  CalendarHeart,
  Check,
  Circle,
  Cpu,
  ExternalLink,
  FileText,
  HeartPulse,
  Megaphone,
  Palette,
  PawPrint,
  Pencil,
  Plus,
  Scale,
  Syringe,
  Trash2,
  VenusAndMars,
} from "lucide-react";
import { deleteMedicalRecord, getAnimal, getAnimalHistory, getAnimalPosts, getMedicalRecords, updateAnimal } from "../services/platformService";
import { getAnimalApplications } from "../services/fundingService";
import { useApi } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import AnimalFact from "../components/AnimalFact";
import FundingMeter from "../components/FundingMeter";
import GoalEditor from "../components/GoalEditor";
import SectionNav from "../components/SectionNav";
import UpdateGrid from "../components/UpdateGrid";
import { PostComposer } from "../components/feed/Composers";
import { AnimalHealthForm, AnimalProfileForm, MedicalEntryForm, StatusMoveDialog, type MedicalDraft } from "../components/AnimalForms";
import {
  HEALTH,
  LEFT_CARE,
  LIFECYCLE_STEPS,
  NEXT_STEP_HINT,
  ageLabel,
  dueChip,
  finalStepLabel,
  formatDay,
  medicalKind,
  outcomeMoves,
  statusMoves,
  type StatusMove,
} from "../utils/animals";
import { formatDate, formatDateTime } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import { statusLabel } from "../utils/statusStyles";
import type { Animal, MedicalRecord } from "../types/platform";
import "./AnimalDetail.css";
import "../components/CaseProgress.css";
import "./AnimalRecord.css";

type Dialog =
  | { kind: "profile" }
  | { kind: "health" }
  | { kind: "post" }
  | { kind: "move"; move: StatusMove }
  | { kind: "entry"; record?: MedicalRecord; draft?: MedicalDraft }
  | null;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "medical", label: "Health" },
  { id: "adoption", label: "Adoption" },
  { id: "funding", label: "Funding" },
  { id: "updates", label: "Updates" },
];

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** Rescued, recovering, up for adoption, then how the animal left. Skipped steps aren't shown as done. */
function Lifecycle({ status }: { status: string }) {
  const finished = LEFT_CARE.includes(status);
  const steps = [
    ...LIFECYCLE_STEPS.filter((step) => step.key !== "adoptable" || !finished || status === "adopted"),
    { key: "final", label: finalStepLabel(status) },
  ];
  const reached = finished ? steps.length - 1 : steps.findIndex((step) => step.key === status);
  return (
    <ol className="case-progress ar-steps" aria-label="Where this animal is in its care">
      {steps.map((step, index) => {
        const state = index < reached || (finished && index === reached) ? "done" : index === reached ? "current" : "todo";
        return (
          <li key={step.key} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="case-progress-dot">{state === "done" ? <Check size={12} /> : null}</span>
            <span className="case-progress-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One animal's record for its rescue team: who it is, how it's doing, and what happens next. */
function AnimalRecord() {
  const { animalId = "" } = useParams();
  const toast = useToast();
  const animal = useApi(() => getAnimal(animalId), animalId);
  const records = useApi(() => getMedicalRecords(animalId), animalId);
  const history = useApi(() => getAnimalHistory(animalId), animalId);
  const applications = useApi(() => getAnimalApplications(animalId), animalId);
  const posts = useApi(() => getAnimalPosts(animalId), animalId);
  const [dialog, setDialog] = useState<Dialog>(null);

  const data = animal.data;
  if (animal.error && !data) {
    return <div className="page"><ErrorState title="Animal not found" message={errorMessage(animal.error)} onRetry={animal.reload} /></div>;
  }
  if (!data) {
    return <div className="page"><Skeleton height={120} /><Skeleton height={420} /></div>;
  }
  // Only the animal's own team gets the checklist, so its absence means another team's animal.
  if (!data.readiness) {
    return (
      <div className="page">
        <EmptyState
          headingLevel={1}
          title={`${data.name} is cared for by another team`}
          message="You can see the public profile, but only their team can manage this record."
          action={<Link to={`/animals/${data.id}`} className="btn btn-secondary btn-sm">Open public profile</Link>}
        />
      </div>
    );
  }

  const finished = LEFT_CARE.includes(data.status);
  const readiness = data.readiness;
  const blockers = readiness.filter((item) => item.required && !item.done);
  const entries = records.data ?? [];
  const followUps = entries.filter((entry) => entry.next_due).sort((a, b) => (a.next_due ?? "").localeCompare(b.next_due ?? ""));
  const weighed = entries.find((entry) => entry.weight_kg);
  const applicants = (applications.data ?? []).filter((item) => item.status !== "withdrawn");
  const pending = applicants.filter((item) => item.status === "pending").length;
  const adopter = applicants.find((item) => item.status === "approved");
  const health = data.health ? HEALTH[data.health] : null;
  const subtitle = [data.breed || data.species, ageLabel(data.age), data.gender, finished ? "" : `${daysSince(data.created_at)} days in care`].filter(Boolean).join(" · ");
  const moves = statusMoves(data.status);
  const outcomes = outcomeMoves(data.status);

  const saved = (updated: Animal, title: string) => {
    animal.setData(updated);
    setDialog(null);
    toast({ title });
  };

  const fix = (key: string) => setDialog(key === "photo" || key === "description" ? { kind: "profile" } : { kind: "health" });

  const removeEntry = async (entry: MedicalRecord) => {
    if (!window.confirm(`Delete "${entry.title}" from ${data.name}'s history?`)) return;
    try {
      await deleteMedicalRecord(entry.id);
      records.reload();
      animal.reload();
      toast({ title: "Entry deleted" });
    } catch (error) {
      toast({ title: "Couldn't delete the entry", body: errorMessage(error), tone: "error" });
    }
  };

  return (
    <div className="page ar">
      <Link to="/animals" className="back-link"><ArrowLeft size={16} /> Rescued animals</Link>

      <header className="ar-head">
        <span className="ar-photo">
          {data.image ? <img src={data.image} alt="" /> : <PawPrint size={26} aria-hidden="true" />}
        </span>
        <div className="ar-head-text">
          <h1>{data.name}</h1>
          <p className="ar-subtitle">{subtitle || "Add breed, age and gender in the profile"}</p>
          <div className="ar-chips">
            <StatusChip kind="animal" value={data.status} />
            {health ? <span className={`chip chip-${health.tone}`}>{health.label}</span> : <span className="chip chip-outline">Health not recorded</span>}
            {data.next_care && !finished ? <span className={`chip ${dueChip(data.next_care.date).className}`}>{data.next_care.title}: {dueChip(data.next_care.date).label.toLowerCase()}</span> : null}
          </div>
        </div>
        <div className="ar-head-actions">
          <Link to={`/animals/${data.id}`} className="btn btn-secondary btn-sm"><ExternalLink size={15} /> Public page</Link>
          <Link to={`/cases/${data.case_id ?? data.case}`} className="btn btn-secondary btn-sm"><FileText size={15} /> Rescue case</Link>
          {!finished ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog({ kind: "post" })}><Megaphone size={15} /> Post update</button> : null}
        </div>
      </header>

      <Lifecycle status={data.status} />

      <div className="ar-layout">
        <aside className="ar-side" aria-label="Status and next steps">
          <section className="ar-panel" aria-labelledby="ar-next">
            <h2 id="ar-next">Next step</h2>
            <p className="ar-hint">{NEXT_STEP_HINT[data.status]}</p>
            <div className="ar-actions">
              {data.status === "adoptable" && pending ? (
                <Link to={`/applications?animal=${data.id}`} className="btn btn-primary btn-block">
                  Review {pending} application{pending === 1 ? "" : "s"}
                </Link>
              ) : null}
              {moves.map((move, index) => {
                const blocked = move.to === "adoptable" && blockers.length > 0;
                const primary = index === 0 && !(data.status === "adoptable" && pending);
                return (
                  <button
                    key={move.label}
                    type="button"
                    className={`btn btn-block ${primary ? "btn-primary" : "btn-secondary"}`}
                    disabled={blocked}
                    aria-describedby={blocked ? "ar-readiness" : undefined}
                    onClick={() => setDialog({ kind: "move", move })}
                  >
                    {move.label}
                  </button>
                );
              })}
            </div>
            {outcomes.length ? (
              <p className="ar-outcomes">
                Left your care another way?{" "}
                {outcomes.map((move, index) => (
                  <span key={move.to}>
                    {index ? " · " : ""}
                    <button type="button" className="link-button" onClick={() => setDialog({ kind: "move", move })}>{move.label}</button>
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          {!finished && data.status !== "adoptable" ? (
            <section className="ar-panel" aria-labelledby="ar-readiness-title">
              <h2 id="ar-readiness-title">Ready for adoption?</h2>
              <p className="ar-hint" id="ar-readiness">
                {blockers.length ? "Required items must be done before you can open adoption." : `${data.name} can be listed whenever you're ready.`}
              </p>
              <ul className="ar-checklist">
                {readiness.map((item) => (
                  <li key={item.key} className={item.done ? "is-done" : ""}>
                    {item.done ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                    {item.done ? (
                      <span>{item.label}</span>
                    ) : (
                      <button type="button" className="link-button" onClick={() => fix(item.key)}>{item.label}</button>
                    )}
                    <span className="ar-check-tag">{item.done ? "Done" : item.required ? "Required" : "Recommended"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ar-panel" aria-labelledby="ar-timeline">
            <h2 id="ar-timeline">Timeline</h2>
            <ol className="story ar-story">
              {(history.data ?? []).map((change) => (
                <li key={change.id}>
                  <span className={`story-dot${LEFT_CARE.includes(change.to_status) ? " tone-green" : ""}`} aria-hidden="true" />
                  <div>
                    <strong>{statusLabel("animal", change.to_status)}</strong>
                    <span className="small muted">{formatDateTime(change.created_at)} · from {statusLabel("animal", change.from_status).toLowerCase()}</span>
                    {change.note ? <p className="small">{change.note}</p> : null}
                  </div>
                </li>
              ))}
              <li>
                <span className="story-dot tone-coral" aria-hidden="true" />
                <div>
                  <strong>Profile created</strong>
                  <span className="small muted">{formatDate(data.created_at)}{data.area ? ` · found in ${data.area}` : ""}</span>
                </div>
              </li>
            </ol>
          </section>
        </aside>

        <div className="ar-main">
          <SectionNav label={`Sections of ${data.name}'s record`} sections={SECTIONS} />

          <section id="profile" className="ar-section" aria-labelledby="ar-profile">
            <div className="ar-section-head">
              <h2 id="ar-profile">Profile</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog({ kind: "profile" })}><Pencil size={14} /> Edit profile</button>
            </div>
            <p className="ar-about">{data.description || <span className="muted">No public description yet. Adopters read this first.</span>}</p>
            <div className="animal-facts">
              <AnimalFact tone="blue" icon={<Cake size={18} />} label="Age" value={ageLabel(data.age) || "Not set"} />
              <AnimalFact tone="coral" icon={<VenusAndMars size={18} />} label="Gender" value={data.gender || "Not set"} />
              <AnimalFact tone="green" icon={<PawPrint size={18} />} label="Breed" value={data.breed || data.species || "Not set"} />
              <AnimalFact tone="amber" icon={<Palette size={18} />} label="Colour" value={data.color || "Not set"} />
              <AnimalFact tone="navy" icon={<Cpu size={18} />} label="Microchip" value={data.microchip_id || "None"} />
              <AnimalFact tone="blue" icon={<CalendarHeart size={18} />} label="Profile created" value={formatDate(data.created_at)} />
            </div>
          </section>

          <section id="medical" className="ar-section" aria-labelledby="ar-medical">
            <div className="ar-section-head">
              <h2 id="ar-medical">Health and medical history</h2>
              <div className="ar-head-buttons">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog({ kind: "health" })}><HeartPulse size={14} /> Update health</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog({ kind: "entry" })}><Plus size={14} /> Add entry</button>
              </div>
            </div>
            <div className="animal-facts">
              <AnimalFact tone={health?.tone ?? "navy"} icon={<HeartPulse size={18} />} label="Health" value={health?.label ?? "Not assessed"} />
              <AnimalFact tone="emerald" icon={<Syringe size={18} />} label="Vaccinated" value={data.vaccinated ? "Yes" : "Not yet"} />
              <AnimalFact tone="purple" icon={<Check size={18} />} label="Spayed or neutered" value={data.sterilized ? "Yes" : "Not yet"} />
              <AnimalFact tone="amber" icon={<Scale size={18} />} label="Latest weight" value={weighed ? `${Number(weighed.weight_kg)} kg` : "Not weighed"} />
            </div>
            <p className="ar-summary">
              <span className="ar-label">Medical summary (public)</span>
              {data.medical_info || <span className="muted">Nothing written yet.</span>}
            </p>

            {followUps.length ? (
              <div className="ar-followups">
                <h3>Coming up</h3>
                <ul>
                  {followUps.map((entry) => (
                    <li key={entry.id}>
                      <span className={`chip ${dueChip(entry.next_due ?? "").className}`}>{dueChip(entry.next_due ?? "").label}</span>
                      <span className="ar-followup-title">{entry.title}</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: "entry", draft: { kind: entry.kind, title: entry.title, vet: entry.vet } })}>
                        Record it
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {records.data ? (
              entries.length ? (
                <ol className="ar-entries">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <div className="ar-entry-top">
                        <span className={`chip ${medicalKind(entry.kind).chip}`}>{entry.kind_label}</span>
                        <strong>{entry.title}</strong>
                        <span className="ar-entry-date">{formatDay(entry.date)}</span>
                      </div>
                      <p className="ar-entry-meta">
                        {[entry.vet, entry.weight_kg ? `${Number(entry.weight_kg)} kg` : "", entry.next_due ? `Follow-up ${formatDay(entry.next_due)}` : "", entry.is_public ? "" : "Team only"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {entry.notes ? <p className="ar-entry-notes">{entry.notes}</p> : null}
                      <div className="ar-entry-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: "entry", record: entry })} aria-label={`Edit ${entry.title}`}><Pencil size={14} /> Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm ar-delete" onClick={() => removeEntry(entry)} aria-label={`Delete ${entry.title}`}><Trash2 size={14} /> Delete</button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  icon={<HeartPulse size={22} />}
                  title="No medical history yet"
                  message="Add the intake check-up, vaccinations, deworming and treatments as they happen."
                />
              )
            ) : (
              <Skeleton height={140} />
            )}
          </section>

          <section id="adoption" className="ar-section" aria-labelledby="ar-adoption">
            <div className="ar-section-head">
              <h2 id="ar-adoption">Adoption</h2>
              {applicants.length && !finished ? <Link to={`/applications?animal=${data.id}`} className="link small">Open in Applications</Link> : null}
            </div>
            {adopter && data.status === "adopted" ? (
              <div className="alert alert-success">
                <span>
                  Adopted by <strong>{adopter.full_name}</strong> · {adopter.phone}{adopter.city ? ` · ${adopter.city}` : ""}
                  {adopter.decided_at ? ` · approved ${formatDate(adopter.decided_at)}` : ""}
                </span>
              </div>
            ) : null}
            {applications.loading && !applications.data ? (
              <Skeleton height={100} />
            ) : applicants.length ? (
              <ul className="animal-app-list">
                {applicants.map((application) => (
                  <li key={application.id}>
                    <Link to={`/applications?animal=${data.id}&application=${application.id}`} className="animal-app-row">
                      <Avatar name={application.full_name} size={36} />
                      <span className="animal-app-text">
                        <span className="strong truncate">{application.full_name}</span>
                        <span className="small muted truncate">{[application.city, `applied ${formatRelativeTime(application.created_at)}`].filter(Boolean).join(" · ")}</span>
                      </span>
                      <StatusChip kind="review" value={application.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {data.status === "adoptable"
                  ? `No one has applied to adopt ${data.name} yet. Applications show up here as they arrive.`
                  : finished
                    ? "No applications were made through StrayAid."
                    : `${data.name} isn't open for adoption yet. Finish the checklist, then open adoption from Next step.`}
              </p>
            )}
            {data.status !== "adoptable" && pending && !finished ? (
              <p className="small muted">{pending} application{pending === 1 ? " is" : "s are"} on hold until adoption opens again.</p>
            ) : null}
          </section>

          <section id="funding" className="ar-section" aria-labelledby="ar-funding">
            <div className="ar-section-head">
              <h2 id="ar-funding">Funding</h2>
              <Link to="/funds" className="link small">Check receipts in Funds</Link>
            </div>
            <FundingMeter raised={data.raised_pkr ?? 0} goal={data.funding_goal_pkr ?? 0} caption={`raised for ${data.name}'s care`} supporters={data.sponsor_count} />
            {!finished ? (
              <GoalEditor
                goal={data.funding_goal_pkr ?? 0}
                onSave={async (value) => {
                  try {
                    saved(await updateAnimal(data.id, { funding_goal_pkr: value }), "Care goal updated");
                  } catch (error) {
                    toast({ title: "Couldn't save the goal", body: errorMessage(error), tone: "error" });
                  }
                }}
              />
            ) : null}
          </section>

          <section id="updates" className="ar-section" aria-labelledby="ar-updates">
            <div className="ar-section-head">
              <h2 id="ar-updates">Updates</h2>
              {!finished ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog({ kind: "post" })}><Megaphone size={14} /> Post update</button> : null}
            </div>
            {posts.data ? (
              posts.data.length ? (
                <UpdateGrid posts={posts.data} compact />
              ) : (
                <p className="muted">No posts about {data.name} yet. Followers and sponsors see updates in their feed.</p>
              )
            ) : (
              <Skeleton height={160} />
            )}
          </section>
        </div>
      </div>

      {dialog?.kind === "profile" ? (
        <AnimalProfileForm animal={data} onClose={() => setDialog(null)} onSaved={(updated) => saved(updated, "Profile saved")} />
      ) : null}
      {dialog?.kind === "health" ? (
        <AnimalHealthForm animal={data} onClose={() => setDialog(null)} onSaved={(updated) => saved(updated, "Health updated")} />
      ) : null}
      {dialog?.kind === "entry" ? (
        <MedicalEntryForm
          animal={data}
          record={dialog.record}
          draft={dialog.draft}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            records.reload();
            // Vaccinations and sterilizations tick the profile, and follow-ups change what's due.
            animal.reload();
            toast({ title: dialog.record ? "Entry updated" : "Added to the medical history" });
          }}
        />
      ) : null}
      {dialog?.kind === "move" ? (
        <StatusMoveDialog
          animal={data}
          move={dialog.move}
          pendingApplications={pending}
          onClose={() => setDialog(null)}
          onSaved={(updated) => {
            saved(updated, `${data.name} is now ${statusLabel("animal", updated.status).toLowerCase()}`);
            history.reload();
            applications.reload();
          }}
        />
      ) : null}
      {dialog?.kind === "post" ? (
        <PostComposer
          animals={[data]}
          initialCategory={data.status === "adoptable" ? "adoption" : "medical"}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            posts.reload();
            toast({ title: "Update posted", body: "Followers will see it in their feed." });
          }}
        />
      ) : null}
    </div>
  );
}

export default AnimalRecord;
