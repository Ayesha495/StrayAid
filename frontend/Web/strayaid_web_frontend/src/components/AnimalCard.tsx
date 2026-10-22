import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";
import type { Animal } from "../types/platform";
import "../styles/AnimalCard.css";

// The status dot uses the workflow colours: amber while in care, purple when adoptable, green once home.
const STATUS_TONE: Record<string, string> = {
  rescued: "amber",
  recovering: "amber",
  adoptable: "purple",
  adopted: "green",
};

const LIFECYCLE_STEPS: { value: string; label: string }[] = [
  { value: "recovering", label: "Recovering" },
  { value: "adoptable", label: "Adoptable" },
  { value: "adopted", label: "Adopted" },
];

function statusClass(status: string): string {
  return `am-status am-status-${STATUS_TONE[status] ?? "gray"}`;
}

function formatStatusLabel(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : status;
}

function daysInCare(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

type AnimalCardProps = {
  animal: Animal;
  onStatusChange?: (animalId: number, status: string) => void;
  footer: ReactNode;
  compact?: boolean;
};

function AnimalCard({ animal, onStatusChange, footer, compact = false }: AnimalCardProps) {
  return (
    <article className="am-animal-card">
      <div className="am-animal-media">
        {animal.image ? (
          <img src={animal.image} alt={animal.name} loading="lazy" />
        ) : (
          <div className="am-media-placeholder"><PawPrint size={28} /></div>
        )}
      </div>
      <div className="am-animal-body">
        <div className="am-animal-title">
          <h3>{animal.name}</h3>
          <span className={statusClass(animal.status)}>{formatStatusLabel(animal.status)}</span>
        </div>
        <p className="am-animal-breed">
          {[
            animal.breed || animal.species || "Breed unknown",
            `${daysInCare(animal.created_at)} days in care`,
            animal.microchip_id ? "Microchipped" : null,
          ].filter(Boolean).join(" · ")}
        </p>
        {compact ? null : <p className="am-animal-desc">{animal.description || "No public description yet."}</p>}
        {compact ? null : (
          <div className="am-lifecycle-row">
            {LIFECYCLE_STEPS.map((step) => {
              const isActive = animal.status === step.value;
              const className = `am-lifecycle-pill${isActive ? " is-active" : ""}`;

              if (!onStatusChange) {
                return <span key={step.value} className={className}>{step.label}</span>;
              }

              return (
                <button
                  key={step.value}
                  type="button"
                  className={className}
                  onClick={() => onStatusChange(animal.id, step.value)}
                  disabled={isActive}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        )}
        {footer}
      </div>
    </article>
  );
}

export default AnimalCard;
