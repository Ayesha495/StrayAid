import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Home, Inbox, LayoutGrid, Stethoscope, Truck } from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import { getCases, getOrganizationAnimals } from "../services/platformService";
import type { Animal, Case } from "../types/platform";
import { caseLabel } from "../utils/identifiers";
import "../styles/Portal.css";

const COPY_BY_GROUP = {
  reported: "Open reported cases that still need an organization to accept them.",
  "in-progress": "Cases your organization has already picked up and is actively working through.",
  rescued: "Animal profiles that are rescued or recovering and still moving through care.",
  adoptable: "Animal profiles that are ready to meet adopters.",
  "under-care": "Animal profiles currently under your care, including rescued, recovering, and adoptable.",
} as const;

const TITLE_BY_GROUP = {
  reported: "Reported Cases",
  "in-progress": "In Progress Cases",
  rescued: "Rescued Animals",
  adoptable: "Animals Up For Adoption",
  "under-care": "Animals Under Care",
} as const;

const GROUP_META: Record<string, { icon: typeof Inbox; tone: "blue" | "amber" | "green" | "purple" | "gray" }> = {
  reported: { icon: Inbox, tone: "blue" },
  "in-progress": { icon: Truck, tone: "amber" },
  rescued: { icon: Stethoscope, tone: "green" },
  adoptable: { icon: Home, tone: "purple" },
  "under-care": { icon: LayoutGrid, tone: "gray" },
};

const ANIMAL_GROUPS = new Set(["rescued", "adoptable", "under-care"]);

function WorkflowListPage() {
  const { group = "reported" } = useParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);

  useEffect(() => {
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  const caseItems = useMemo(() => {
    if (group === "reported") {
      return cases
        .filter((caseItem) => !caseItem.organization && caseItem.status === "reported")
        .map((caseItem) => ({
          id: caseItem.id,
          heading: caseLabel(caseItem.id),
          description: caseItem.description,
          href: `/cases/${caseItem.id}`,
        }));
    }

    if (group === "in-progress") {
      return cases
        .filter((caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status))
        .map((caseItem) => ({
          id: caseItem.id,
          heading: caseLabel(caseItem.id),
          description: caseItem.description,
          href: `/cases/${caseItem.id}`,
        }));
    }

    return [];
  }, [cases, group]);

  const animalItems = useMemo(() => {
    if (group === "rescued") {
      return animals.filter((animal) => ["rescued", "recovering"].includes(animal.status));
    }
    if (group === "adoptable") {
      return animals.filter((animal) => animal.status === "adoptable");
    }
    if (group === "under-care") {
      return animals.filter((animal) => ["rescued", "recovering", "adoptable"].includes(animal.status));
    }
    return [];
  }, [animals, group]);

  const isAnimalGroup = ANIMAL_GROUPS.has(group);
  const itemCount = isAnimalGroup ? animalItems.length : caseItems.length;
  const title = TITLE_BY_GROUP[group as keyof typeof TITLE_BY_GROUP] || TITLE_BY_GROUP.reported;
  const copy = COPY_BY_GROUP[group as keyof typeof COPY_BY_GROUP] || COPY_BY_GROUP.reported;
  const meta = GROUP_META[group] || GROUP_META.reported;
  const GroupIcon = meta.icon;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        <Link className="btn btn-secondary" to="/dashboard"><ArrowLeft size={14} /> Back to Dashboard</Link>
      </div>

      <section className="panel-card">
        <div className="section-heading">
          <div className="cases-heading-row">
            <span className={`cases-heading-icon${meta.tone !== "gray" ? ` cases-heading-icon-${meta.tone}` : ""}`}>
              <GroupIcon size={18} />
            </span>
            <div>
              <h2>{title}</h2>
              <p className="meta-line">{itemCount} item{itemCount === 1 ? "" : "s"} in this list.</p>
            </div>
          </div>
        </div>

        {isAnimalGroup ? (
          <div className="under-care-grid">
            {animalItems.length ? animalItems.map((animal) => (
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
            )) : <div className="empty-state">Nothing is in this list right now.</div>}
          </div>
        ) : (
          <div className="card-grid">
            {caseItems.length ? caseItems.map((item) => (
              <Link className={`status-card status-card-${meta.tone}`} key={item.id} to={item.href}>
                <strong>{item.heading}</strong>
                <p className="status-card-desc">{item.description}</p>
              </Link>
            )) : <div className="empty-state">Nothing is in this list right now.</div>}
          </div>
        )}
      </section>
    </div>
  );
}

export default WorkflowListPage;
