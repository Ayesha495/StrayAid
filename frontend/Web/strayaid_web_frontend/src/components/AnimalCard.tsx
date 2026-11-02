import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PawPrint } from "lucide-react";
import type { Animal } from "../types/platform";
import { HEALTH, dueChip, isInCare } from "../utils/animals";
import { statusLabel } from "../utils/statusStyles";
import "../styles/AnimalCard.css";

// The status dot uses the workflow colours: amber while in care, purple when adoptable, green once home.
const STATUS_TONE: Record<string, string> = {
  rescued: "amber",
  recovering: "amber",
  adoptable: "purple",
  adopted: "green",
};

function daysInCare(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

type AnimalCardProps = {
  animal: Animal;
  footer?: ReactNode;
  compact?: boolean;
};

/** An animal in the team's grid. The photo and name open its record. */
function AnimalCard({ animal, footer, compact = false }: AnimalCardProps) {
  const record = `/animals/${animal.id}/manage`;
  const inCare = isInCare(animal);
  const health = animal.health ? HEALTH[animal.health] : null;
  const due = inCare && animal.next_care ? dueChip(animal.next_care.date) : null;
  return (
    <article className="am-animal-card">
      <Link to={record} className="am-animal-media" tabIndex={-1} aria-hidden="true">
        {animal.image ? (
          <img src={animal.image} alt="" loading="lazy" />
        ) : (
          <div className="am-media-placeholder"><PawPrint size={28} /></div>
        )}
      </Link>
      <div className="am-animal-body">
        <div className="am-animal-title">
          <h3><Link to={record} className="am-animal-link">{animal.name}</Link></h3>
          <span className={`am-status am-status-${STATUS_TONE[animal.status] ?? "gray"}`}>{statusLabel("animal", animal.status)}</span>
        </div>
        <p className="am-animal-breed">
          {[
            animal.breed || animal.species || "Breed unknown",
            inCare ? `${daysInCare(animal.created_at)} days in care` : null,
            animal.microchipped || animal.microchip_id ? "Microchipped" : null,
          ].filter(Boolean).join(" · ")}
        </p>
        {compact ? null : (
          <div className="am-animal-tags">
            {inCare ? (health ? <span className={`chip chip-${health.tone}`}>{health.label}</span> : <span className="chip chip-outline">Health not recorded</span>) : null}
            {due && animal.next_care ? <span className={`chip ${due.className}`}>{animal.next_care.title}: {due.label.toLowerCase()}</span> : null}
          </div>
        )}
        {compact ? null : <p className="am-animal-desc">{animal.description || "No public description yet."}</p>}
        {footer}
      </div>
    </article>
  );
}

export default AnimalCard;
