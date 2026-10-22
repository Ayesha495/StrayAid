import { Gauge } from "lucide-react";

/** The AI rescue priority score (0-100) as a mint chip, like the mobile app's "74% AI Match". */
function ScoreBadge({ score, compact = false }: { score: number | null | undefined; compact?: boolean }) {
  const scored = score !== null && score !== undefined;
  return (
    <span className={`chip ${scored ? "chip-green" : "chip-slate"}`} title="AI rescue priority score">
      <Gauge size={11} aria-hidden="true" />
      {!scored ? "Not scored" : compact ? `${score}%` : `${score}% AI match`}
    </span>
  );
}

export default ScoreBadge;
