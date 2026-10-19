import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, PawPrint } from "lucide-react";
import { getCases, getOrganizationAnimals } from "../services/platformService";
import type { Animal, Case } from "../types/platform";
import { casePhoto } from "../utils/cases";
import { formatPkr } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import ScoreBadge from "../ui/ScoreBadge";
import "../styles/Portal.css";
import "./WorkflowListPage.css";

const GROUPS = [
  { key: "reported", label: "Reported" },
  { key: "in-progress", label: "In progress" },
  { key: "rescued", label: "Recovering" },
  { key: "adoptable", label: "Adoptable" },
  { key: "under-care", label: "All in care" },
];

type Row = { id: number; heading: string; description: string; href: string; image: string | null; meta: ReactNode };

const caseRow = (caseItem: Case): Row => ({
  id: caseItem.id,
  heading: caseItem.title || `Case #${caseItem.id}`,
  description: caseItem.description,
  href: `/cases/${caseItem.id}`,
  image: casePhoto(caseItem),
  meta: (
    <>
      <ScoreBadge score={caseItem.confidence_score} compact />
      <span>Reported {formatRelativeTime(caseItem.created_at)}</span>
      {caseItem.area ? <span>{caseItem.area}</span> : null}
    </>
  ),
});

const animalRow = (animal: Animal): Row => ({
  id: animal.id,
  heading: animal.name,
  description: animal.description || "Animal profile ready for care updates.",
  href: `/animals/${animal.id}`,
  image: animal.image ?? null,
  meta: (
    <>
      <span className={`wf-status wf-status-${animal.status}`}>{animal.status}</span>
      <span>{animal.breed || animal.species}</span>
      {animal.funding_goal_pkr ? <span className="wf-money">{formatPkr(animal.raised_pkr ?? 0)} of {formatPkr(animal.funding_goal_pkr)}</span> : null}
    </>
  ),
});

const COPY_BY_GROUP = {
  reported: "Open reported cases that still need an organization to accept them.",
  "in-progress": "Cases your organization has already picked up and is actively working through.",
  rescued: "Animal profiles that are rescued or recovering and still moving through care.",
  adoptable: "Animal profiles that are ready to meet adopters.",
  "under-care": "Animal profiles currently under your care, including rescued, recovering, and adoptable.",
} as const;

function WorkflowListPage() {
  const { group = "reported" } = useParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);

  useEffect(() => {
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  const content = useMemo(() => {
    if (group === "reported") {
      return {
        title: "Reported Cases",
        items: cases
          .filter((caseItem) => !caseItem.organization && caseItem.status === "reported")
          .map(caseRow),
      };
    }

    if (group === "in-progress") {
      return {
        title: "In Progress Cases",
        items: cases
          .filter((caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status))
          .map(caseRow),
      };
    }

    if (group === "rescued") {
      return {
        title: "Rescued Animals",
        items: animals
          .filter((animal) => ["rescued", "recovering"].includes(animal.status))
          .map(animalRow),
      };
    }

    if (group === "adoptable") {
      return {
        title: "Animals Up For Adoption",
        items: animals
          .filter((animal) => animal.status === "adoptable")
          .map(animalRow),
      };
    }

    return {
      title: "Animals Under Care",
      items: animals
        .filter((animal) => ["rescued", "recovering", "adoptable"].includes(animal.status))
        .map(animalRow),
    };
  }, [animals, cases, group]);

  const copy = COPY_BY_GROUP[group as keyof typeof COPY_BY_GROUP] || COPY_BY_GROUP.reported;

  return (
    <div className="portal-page">
      <Link to="/dashboard" className="wf-back"><ArrowLeft size={16} /> Dashboard</Link>
      <div className="portal-header">
        <div>
          <h1>{content.title}</h1>
          <p>{copy}</p>
        </div>
      </div>

      <nav className="tabs wf-tabs" aria-label="Rescue workflow lists">
        {GROUPS.map((item) => (
          <NavLink key={item.key} to={`/dashboard/workflow/${item.key}`} className="tab" aria-selected={group === item.key}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <section className="panel-card wf-list">
        <p className="meta-line wf-count">{content.items.length} {content.items.length === 1 ? "item" : "items"}</p>
        {content.items.length ? (
          <ul>
            {content.items.map((item) => (
              <li key={item.id}>
                <Link className="wf-row" to={item.href}>
                  <span className="wf-thumb">{item.image ? <img src={item.image} alt="" /> : <PawPrint size={20} />}</span>
                  <span className="wf-body">
                    <strong>{item.heading}</strong>
                    <span className="wf-desc">{item.description}</span>
                    <span className="wf-meta">{item.meta}</span>
                  </span>
                  <ChevronRight size={18} className="wf-chevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="empty-state">Nothing is in this list right now.</div>}
      </section>
    </div>
  );
}

export default WorkflowListPage;
