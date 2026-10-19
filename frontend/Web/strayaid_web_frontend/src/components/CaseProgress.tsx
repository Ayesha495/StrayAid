import { Check } from "lucide-react";
import "./CaseProgress.css";

const STEPS = [
  { key: "reported", label: "Reported" },
  { key: "assigned", label: "Team assigned" },
  { key: "in_progress", label: "Rescue under way" },
  { key: "rescued", label: "Rescued" },
];

const ORDER = ["reported", "assigned", "in_progress", "rescued", "adoption", "closed"];

/** Where a rescue is, as a four-step tracker for reporters and the public case page. */
function CaseProgress({ status, compact = false }: { status: string; compact?: boolean }) {
  const reached = ORDER.indexOf(status);
  // Adoption and closed both mean the rescue part is finished.
  const current = Math.min(reached, STEPS.length - 1);
  return (
    <ol className={`case-progress${compact ? " is-compact" : ""}`} aria-label="Rescue progress">
      {STEPS.map((step, index) => {
        const state = index < current || (index === current && reached >= STEPS.length - 1) ? "done" : index === current ? "current" : "todo";
        return (
          <li key={step.key} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="case-progress-dot">{state === "done" ? <Check size={12} /> : null}</span>
            <span className="case-progress-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default CaseProgress;
