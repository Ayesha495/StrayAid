import { Gauge } from "lucide-react";
import { scoreTone } from "../utils/format";

const TONE_CLASS: Record<string, string> = {
  high: "chip-solid-coral",
  medium: "chip-coral",
  low: "chip-navy",
  none: "chip-outline",
};

/** The AI rescue priority score (0-100) as a chip. */
function ScoreBadge({ score, compact = false }: { score: number | null | undefined; compact?: boolean }) {
  const scored = score !== null && score !== undefined;
  const label = scored ? `${score}%` : "Not scored";
  return (
    <span className={`chip ${TONE_CLASS[scoreTone(score)]}`} title="AI rescue priority score">
      <Gauge size={11} aria-hidden="true" />
      {compact || !scored ? label : `${label} priority`}
    </span>
  );
}

export default ScoreBadge;
