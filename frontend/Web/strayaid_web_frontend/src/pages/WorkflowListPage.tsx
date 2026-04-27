import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCases, getOrganizationAnimals } from "../services/platformService";
import type { Animal, Case } from "../types/platform";
import "../styles/Portal.css";

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
          .map((caseItem) => ({
            id: caseItem.id,
            heading: `Case #${caseItem.id}`,
            description: caseItem.description,
            href: `/cases/${caseItem.id}`,
          })),
      };
    }

    if (group === "in-progress") {
      return {
        title: "In Progress Cases",
        items: cases
          .filter((caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status))
          .map((caseItem) => ({
            id: caseItem.id,
            heading: `Case #${caseItem.id}`,
            description: caseItem.description,
            href: `/cases/${caseItem.id}`,
          })),
      };
    }

    if (group === "rescued") {
      return {
        title: "Rescued Animals",
        items: animals
          .filter((animal) => ["rescued", "recovering"].includes(animal.status))
          .map((animal) => ({
            id: animal.id,
            heading: animal.name,
            description: animal.description || "Animal profile ready for care updates.",
            href: `/animals/${animal.id}`,
          })),
      };
    }

    if (group === "adoptable") {
      return {
        title: "Animals Up For Adoption",
        items: animals
          .filter((animal) => animal.status === "adoptable")
          .map((animal) => ({
            id: animal.id,
            heading: animal.name,
            description: animal.description || "Ready for sponsors and adopters.",
            href: `/animals/${animal.id}`,
          })),
      };
    }

    return {
      title: "Animals Under Care",
      items: animals
        .filter((animal) => ["rescued", "recovering", "adoptable"].includes(animal.status))
        .map((animal) => ({
          id: animal.id,
          heading: animal.name,
          description: animal.description || "Animal profile ready for care updates.",
          href: `/animals/${animal.id}`,
        })),
    };
  }, [animals, cases, group]);

  const copy = COPY_BY_GROUP[group as keyof typeof COPY_BY_GROUP] || COPY_BY_GROUP.reported;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{content.title}</h1>
          <p>{copy}</p>
        </div>
        <Link className="secondary-btn" to="/dashboard">Back To Dashboard</Link>
      </div>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>{content.title}</h2>
            <p className="meta-line">{content.items.length} item{content.items.length === 1 ? "" : "s"} in this list.</p>
          </div>
        </div>
        <div className="stacked-feed">
          {content.items.length ? content.items.map((item) => (
            <Link className="status-card" key={item.id} to={item.href}>
              <strong>{item.heading}</strong>
              <p>{item.description}</p>
            </Link>
          )) : <div className="empty-state">Nothing is in this list right now.</div>}
        </div>
      </section>
    </div>
  );
}

export default WorkflowListPage;
