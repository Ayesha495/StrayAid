import { useEffect, useState } from "react";
import RescueBoard from "../components/RescueBoard";
import { getCases, getOrganizationAnimals } from "../services/platformService";
import type { Animal, Case } from "../types/platform";

function Cases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);

  useEffect(() => {
    getCases().then(setCases).catch(() => setCases([]));
    getOrganizationAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  return (
    <RescueBoard
      cases={cases}
      animals={animals}
      heading="Cases"
      copy="Use this board to claim reported cases, monitor in-progress rescues, and jump straight into rescued or adoptable animal profiles."
    />
  );
}

export default Cases;
