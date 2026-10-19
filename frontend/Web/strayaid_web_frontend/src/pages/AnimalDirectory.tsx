import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, HandCoins, Heart, Home, PawPrint, Search } from "lucide-react";
import AnimalTile from "../components/AnimalTile";
import FilterTiles from "../ui/FilterTiles";
import { EmptyState, LoadingRows } from "../ui/States";
import { getPublicAnimals, getPublicOrganization } from "../services/platformService";
import type { Animal, Organization } from "../types/platform";
import "./AnimalDirectory.css";

const PAGE_SIZE = 12;

type Need = "home" | "sponsor" | "adopted" | "all";
const NEEDS: Record<Need, (animal: Animal) => boolean> = {
  home: (animal) => animal.status === "adoptable",
  sponsor: (animal) => animal.status === "rescued" || animal.status === "recovering",
  adopted: (animal) => animal.status === "adopted",
  all: () => true,
};

const SPECIES = [
  { key: "", label: "All" },
  { key: "dog", label: "Dogs" },
  { key: "cat", label: "Cats" },
  { key: "other", label: "Others" },
];

const gap = (animal: Animal) => Math.max(0, (animal.funding_goal_pkr ?? 0) - (animal.raised_pkr ?? 0));

/** "Meet the animals": the public directory, for people looking to adopt or sponsor. */
function AnimalDirectory() {
  const [params, setParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [loadedOrganization, setOrganization] = useState<Organization | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const organizationId = params.get("organizationId") ?? "";
  const need = (params.get("need") as Need) || "all";
  const species = params.get("species") ?? "";
  const sort = params.get("sort") ?? "need";
  const query = params.get("q") ?? "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setVisible(PAGE_SIZE);
  };

  useEffect(() => {
    getPublicAnimals(organizationId ? { organizationId } : undefined).then(setAnimals).catch(() => setAnimals([]));
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    getPublicOrganization(organizationId).then(setOrganization).catch(() => setOrganization(null));
  }, [organizationId]);
  // Only show the team that matches the current link.
  const organization = loadedOrganization && String(loadedOrganization.id) === organizationId ? loadedOrganization : null;

  const bySpecies = useMemo(() => (animals ?? []).filter((animal) => {
    const kind = (animal.species ?? "").toLowerCase();
    if (!species) return true;
    if (species === "other") return kind !== "dog" && kind !== "cat";
    return kind === species;
  }), [animals, species]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase();
    const list = bySpecies
      .filter(NEEDS[need])
      .filter((animal) => !words || [animal.name, animal.breed, animal.species, animal.organization?.name].join(" ").toLowerCase().includes(words));
    // "Needs help most": the furthest from their care goal first, so a gift goes where it matters.
    return sort === "newest"
      ? [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : [...list].sort((a, b) => gap(b) - gap(a));
  }, [bySpecies, need, query, sort]);

  const count = (key: Need) => bySpecies.filter(NEEDS[key]).length;

  return (
    <div className="ds page directory">
      {organization ? (
        <Link to={`/organizations/${organization.id}`} className="back-link"><ArrowLeft size={16} /> {organization.name}</Link>
      ) : null}
      <header className="directory-head">
        <div>
          <h1>{organization ? `${organization.name}'s animals` : "Meet the animals"}</h1>
          <p>Every animal here was rescued from the street by a verified team. Adopt one, or help cover their care.</p>
        </div>
        <label className="input-with-icon directory-search">
          <Search size={16} />
          <input className="input" type="search" placeholder="Search by name, breed or rescue team" value={query} onChange={(event) => setParam("q", event.target.value)} aria-label="Search animals" />
        </label>
      </header>

      <FilterTiles<Need>
        label="What they need"
        value={need}
        onChange={(key) => setParam("need", key === "all" ? "" : key)}
        tiles={[
          { key: "home", label: "Looking for a home", hint: "ready to adopt", count: count("home"), icon: <Home size={16} />, tint: "purple" },
          { key: "sponsor", label: "Needs sponsors", hint: "still recovering", count: count("sponsor"), icon: <HandCoins size={16} />, tint: "amber" },
          { key: "adopted", label: "Adopted", hint: "happy endings", count: count("adopted"), icon: <Heart size={16} />, tint: "green" },
          { key: "all", label: "Everyone", hint: "all animals", count: bySpecies.length, icon: <PawPrint size={16} />, tint: "blue" },
        ]}
      />

      <div className="directory-toolbar">
        <div className="tabs" role="group" aria-label="Species">
          {SPECIES.map((item) => (
            <button key={item.key} type="button" className="tab" aria-selected={species === item.key} aria-pressed={species === item.key} onClick={() => setParam("species", item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="directory-sort">
          <span className="small muted">Sort by</span>
          <select className="select" value={sort} onChange={(event) => setParam("sort", event.target.value === "need" ? "" : event.target.value)}>
            <option value="need">Needs help most</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      {animals === null ? (
        <LoadingRows rows={3} height={220} />
      ) : results.length ? (
        <>
          <p className="small muted" aria-live="polite">{results.length} {results.length === 1 ? "animal" : "animals"}</p>
          <div className="directory-grid">
            {results.slice(0, visible).map((animal) => <AnimalTile key={animal.id} animal={animal} showOrganization={!organization} />)}
          </div>
          {visible < results.length ? (
            <button type="button" className="btn btn-secondary directory-more" onClick={() => setVisible(visible + PAGE_SIZE)}>
              Show more animals
            </button>
          ) : null}
        </>
      ) : (
        <div className="card">
          <EmptyState icon={<PawPrint size={22} />} title="No animals match" message="Try another filter, or clear the search." />
        </div>
      )}
    </div>
  );
}

export default AnimalDirectory;
