import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Archive, FileText, House, LayoutGrid, Megaphone, Plus, Search, Stethoscope } from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import FundingMeter from "../components/FundingMeter";
import { AnimalProfileForm } from "../components/AnimalForms";
import { PostComposer } from "../components/feed/Composers";
import { getMyCases, getOrganizationAnimals } from "../services/platformService";
import { useApi } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import { ErrorState } from "../ui/States";
import { errorMessage } from "../utils/errors";
import { LEFT_CARE } from "../utils/animals";
import type { Animal } from "../types/platform";
import "../styles/Portal.css";
import "../styles/AnimalManagement.css";

type Filter = "all" | "care" | "adoptable" | "archive";

// Animals that have left care (adopted, back home, passed away) live in the archive: kept for the
// team's records, out of the working list and out of every public list.
const FILTERS: { key: Filter; label: string; hint: string; icon: LucideIcon; tint: string; test: (animal: Animal) => boolean }[] = [
  { key: "all", label: "With the team", hint: "every animal in care", icon: LayoutGrid, tint: "blue", test: (animal) => !LEFT_CARE.includes(animal.status) },
  { key: "care", label: "In care", hint: "rescued or recovering", icon: Stethoscope, tint: "coral", test: (animal) => animal.status === "rescued" || animal.status === "recovering" },
  { key: "adoptable", label: "Adoptable", hint: "ready for a home", icon: House, tint: "purple", test: (animal) => animal.status === "adoptable" },
  { key: "archive", label: "Archive", hint: "adopted, back home or passed away", icon: Archive, tint: "green", test: (animal) => LEFT_CARE.includes(animal.status) },
];

/** Every animal the team has rescued. Each card opens the animal's record, where it is managed. */
function AnimalManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const animals = useApi(getOrganizationAnimals);
  const cases = useApi(getMyCases);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showPost, setShowPost] = useState(false);
  // Arriving from a case ("Create animal profile") opens the form straight away.
  const caseId = searchParams.get("caseId") ?? "";
  const [showForm, setShowForm] = useState(Boolean(caseId));

  const all = useMemo(() => animals.data ?? [], [animals.data]);
  // Rescued cases that don't have a profile yet; each can only ever have one.
  const openCases = (cases.data ?? []).filter((item) => item.status === "rescued" && !item.animal_profile);
  const active = FILTERS.find((item) => item.key === filter) ?? FILTERS[0];
  const words = query.trim().toLowerCase();
  const shown = all.filter(
    (animal) => active.test(animal) && (!words || [animal.name, animal.breed, animal.species].some((value) => value?.toLowerCase().includes(words))),
  );

  const closeForm = () => {
    setShowForm(false);
    if (caseId) setSearchParams({}, { replace: true });
  };

  if (animals.error && !animals.data) {
    return <div className="portal-page"><ErrorState title="Couldn't load your animals" message={errorMessage(animals.error)} onRetry={animals.reload} /></div>;
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Animals</h1>
          <p>Every animal in your care. Open one to update its profile, health and medical history, or move it to the next stage.</p>
        </div>
        <div className="portal-actions">
          <button className="secondary-btn" type="button" onClick={() => setShowPost(true)} disabled={!all.length}>
            <Megaphone size={15} /> Post update
          </button>
          <button className="primary-btn" type="button" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add animal
          </button>
        </div>
      </div>

      {/* The statuses double as filters: one glance tells the team where everyone is. */}
      <div className="am-tiles" role="group" aria-label="Filter animals by status">
        {FILTERS.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={`am-tile tint-${tile.tint}${filter === tile.key ? " is-active" : ""}`}
            aria-pressed={filter === tile.key}
            onClick={() => setFilter(tile.key)}
          >
            <span className="am-tile-icon"><tile.icon size={16} /></span>
            <span className="am-tile-value">{all.filter(tile.test).length}</span>
            <span className="am-tile-label">{tile.label} <span>{tile.hint}</span></span>
          </button>
        ))}
      </div>

      <label className="am-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Search your animals</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, breed or species" />
      </label>

      <section className="am-section" aria-label={active.label}>
        <div className="card-grid am-animal-grid">
          {shown.length ? shown.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              footer={
                <>
                  {animal.funding_goal_pkr && animal.status !== "adopted" ? <FundingMeter size="sm" raised={animal.raised_pkr ?? 0} goal={animal.funding_goal_pkr} caption="raised" /> : null}
                  {animal.application_count ? (
                    <span className="am-card-links">
                      <Link className="am-public-link" to={`/applications?animal=${animal.id}`}>
                        <FileText size={14} /> {animal.application_count} application{animal.application_count === 1 ? "" : "s"}
                      </Link>
                    </span>
                  ) : null}
                </>
              }
            />
          )) : (
            <div className="empty-state">
              {!animals.data ? "Loading animals…" : all.length ? "No animals match." : "No animals yet. Add one from a rescued case to get started."}
            </div>
          )}
        </div>
      </section>

      {showForm ? (
        openCases.length || !cases.data ? (
          <AnimalProfileForm
            cases={openCases}
            initialCase={caseId}
            onClose={closeForm}
            onSaved={(animal) => {
              closeForm();
              toast({ title: `${animal.name}'s profile is ready`, body: "Add a first check-up to start the medical history." });
              navigate(`/animals/${animal.id}/manage`);
            }}
          />
        ) : (
          <NoCaseNotice onClose={closeForm} />
        )
      ) : null}

      {showPost ? (
        <PostComposer
          animals={all.filter((animal) => animal.status !== "released" && animal.status !== "deceased")}
          onClose={() => setShowPost(false)}
          onSaved={() => {
            setShowPost(false);
            toast({ title: "Update posted", body: "Followers will see it in their feed." });
          }}
        />
      ) : null}
    </div>
  );
}

function NoCaseNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="ds sa-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="no-case-title">
        <div className="sa-modal-header"><h2 id="no-case-title">No rescued case waiting</h2></div>
        <div className="modal-body">
          <p>Every animal profile starts from a rescue. Mark a case as rescued on the rescue board, then create the animal's profile from it.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <Link to="/cases" className="btn btn-primary">Open rescue requests</Link>
        </div>
      </div>
    </div>
  );
}

export default AnimalManagement;
