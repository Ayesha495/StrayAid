import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import RescueBoard from "../components/RescueBoard";
import { getCases, getOrganizationAnimals } from "../services/platformService";
import type { Animal, Case } from "../types/platform";

function Cases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  useEffect(() => {
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  const filteredCases = useMemo(() => {
    if (!query) {
      return cases;
    }
    return cases.filter((caseItem) => caseItem.description.toLowerCase().includes(query));
  }, [cases, query]);

  const filteredAnimals = useMemo(() => {
    if (!query) {
      return animals;
    }
    return animals.filter((animal) => animal.name.toLowerCase().includes(query));
  }, [animals, query]);

  return (
    <RescueBoard
      cases={filteredCases}
      animals={filteredAnimals}
      heading="Cases"
      copy={query ? `Showing results for "${query}".` : "Use this board to claim reported cases and monitor each rescue stage through to adoption readiness."}
    />
  );
}

export default Cases;
