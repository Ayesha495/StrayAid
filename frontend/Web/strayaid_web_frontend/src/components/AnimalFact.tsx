import type { ReactNode } from "react";

/** One fact about an animal with a tinted icon. Styled in pages/AnimalDetail.css. */
function AnimalFact({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return (
    <div className="animal-fact">
      <span className={`animal-fact-icon tone-${tone}`} aria-hidden="true">{icon}</span>
      <span>
        <span className="animal-fact-label">{label}</span>
        <span className="animal-fact-value">{value}</span>
      </span>
    </div>
  );
}

export default AnimalFact;
