import type { ReactNode } from "react";
import { CalendarDays, PawPrint, ScanLine } from "lucide-react";
import type { Animal } from "../types/platform";
import "../styles/AnimalCard.css";

const STATUS_RIBBON_CLASS: Record<string, string> = {
  rescued: "am-ribbon-green",
  recovering: "am-ribbon-amber",
  adoptable: "am-ribbon-purple",
  adopted: "am-ribbon-green",
};

const LIFECYCLE_STEPS: { value: string; label: string }[] = [
  { value: "recovering", label: "Recovering" },
  { value: "adoptable", label: "Adoptable" },
  { value: "adopted", label: "Adopted" },
];

function ribbonClass(status: string): string {
  return `am-status-ribbon ${STATUS_RIBBON_CLASS[status] ?? "am-ribbon-gray"}`;
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
          <img src={animal.image} alt={animal.name} />
        ) : (
          <div className="am-media-placeholder"><PawPrint size={32} /></div>
        )}
        <span className={ribbonClass(animal.status)}>{formatStatusLabel(animal.status)}</span>
        <span className="am-id-tag">#A-{animal.id}</span>
        <div className="am-media-overlay">
          <span className="am-media-overlay-stay"><CalendarDays size={12} /> Shelter Stay: {daysInCare(animal.created_at)} Days</span>
          {animal.microchip_id ? <span className="am-microchip-tag"><ScanLine size={11} /> Microchipped</span> : null}
        </div>
      </div>
      <div className="am-animal-body">
        <h3>{animal.name}</h3>
        <p className="am-animal-breed">{animal.breed || animal.species || "Breed unknown"}</p>
        <p className="am-animal-desc">{animal.description || "No public description yet."}</p>
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
