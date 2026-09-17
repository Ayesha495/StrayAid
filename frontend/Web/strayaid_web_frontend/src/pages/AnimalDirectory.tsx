import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AnimalCard from "../components/AnimalCard";
import { getPublicAnimals, getPublicOrganization } from "../services/platformService";
import type { Animal, Organization } from "../types/platform";
import "../styles/Portal.css";

const ANIMALS_PER_PAGE = 9;

function AnimalDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);

  const organizationId = searchParams.get("organizationId") ?? "";
  const currentPage = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);

  useEffect(() => {
    getPublicAnimals(organizationId ? { organizationId } : undefined).then(setAnimals).catch(() => setAnimals([]));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setOrganization(null);
      return;
    }

    getPublicOrganization(organizationId).then(setOrganization).catch(() => setOrganization(null));
  }, [organizationId]);

  const totalPages = Math.max(1, Math.ceil(animals.length / ANIMALS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (safePage === currentPage) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(safePage));
    setSearchParams(nextParams, { replace: true });
  }, [currentPage, safePage, searchParams, setSearchParams]);

  const visibleAnimals = useMemo(() => {
    const startIndex = (safePage - 1) * ANIMALS_PER_PAGE;
    return animals.slice(startIndex, startIndex + ANIMALS_PER_PAGE);
  }, [animals, safePage]);

  const handlePageChange = (page: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(page));
    setSearchParams(nextParams);
  };

  const title = organization ? `${organization.name} Animal Profiles` : "All Animal Profiles";
  const copy = organization
    ? "Browse every public animal profile shared by this organization."
    : "Browse the full public directory of animal profiles shared across StrayAid.";

  return (
    <div className="portal-page" style={{ padding: "32px" }}>
      <div className="portal-header">
        <div>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        <Link className="secondary-btn" to={organization ? `/organizations/${organization.id}` : "/feed"}>
          {organization ? "Back To Organization" : "Back To Feed"}
        </Link>
      </div>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Animal Profiles</h2>
            <p className="meta-line">
              {animals.length} public profile{animals.length === 1 ? "" : "s"} available.
            </p>
          </div>
          <span className="badge">Page {safePage} of {totalPages}</span>
        </div>

        <div className="card-grid">
          {visibleAnimals.length ? visibleAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              footer={
                <>
                  <p className="meta-line">
                    <Link className="inline-link" to={`/organizations/${animal.organization.id}`}>
                      {animal.organization.name}
                    </Link>
                  </p>
                  <div className="feed-actions">
                    <Link className="secondary-btn" to={`/animals/${animal.id}`}>View Profile</Link>
                    <Link className="secondary-btn" to={`/organizations/${animal.organization.id}`}>View Organization</Link>
                  </div>
                </>
              }
            />
          )) : <div className="empty-state">No public animal profiles are available right now.</div>}
        </div>

        {animals.length > ANIMALS_PER_PAGE ? (
          <div className="pagination-bar">
            <button
              className="secondary-btn"
              type="button"
              disabled={safePage <= 1}
              onClick={() => handlePageChange(safePage - 1)}
            >
              Previous
            </button>
            <span className="meta-line">Showing page {safePage} of {totalPages}</span>
            <button
              className="secondary-btn"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => handlePageChange(safePage + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default AnimalDirectory;
