import { Camera, Clock, Gauge, TriangleAlert, Users } from "lucide-react";
import type { CaseAi } from "../types/api";
import { scoreTone } from "../utils/format";
import "./ScoreBreakdown.css";

// Mirrors backend/rescue/utils/scoring.py:
//   score = round(100 × (0.5·photo + 0.3·severity + 0.2·reports) × freshness)
const WEIGHTS = { photo: 0.5, severity: 0.3, reports: 0.2 };

function Factor({ icon, label, detail, value, weight }: { icon: React.ReactNode; label: string; detail: string; value: number; weight: number }) {
  const points = Math.round(value * weight * 100);
  const max = Math.round(weight * 100);
  return (
    <li className="score-factor">
      <div className="score-factor-head">
        <span className="row">{icon}<span className="strong">{label}</span></span>
        <span className="small"><strong>{points}</strong><span className="muted"> / {max} pts</span></span>
      </div>
      <span className="progress" aria-hidden="true"><span style={{ width: `${Math.round(value * 100)}%` }} /></span>
      <span className="small muted">{detail}</span>
    </li>
  );
}

/** Explains the AI rescue priority score: what each input contributed. */
function ScoreBreakdown({ score, ai }: { score: number | null; ai: CaseAi }) {
  if (!ai.scored || ai.photo_confidence === null) {
    return (
      <p className="muted small">
        This case hasn't been scored yet. The score appears once the AI has checked the report photo.
      </p>
    );
  }

  const photo = ai.photo_confidence;
  const freshnessPct = Math.round(ai.freshness * 100);

  return (
    <div className="score-breakdown">
      <div className={`score-total tone-${scoreTone(score)}`}>
        <Gauge size={18} aria-hidden="true" />
        <span className="score-total-value">{score ?? "–"}%</span>
        <span className="small">rescue priority</span>
      </div>

      <ul className="score-factors">
        <Factor
          icon={<Camera size={15} />}
          label="Photo evidence"
          value={photo}
          weight={WEIGHTS.photo}
          detail={`${Math.round(photo * 100)}% sure ${ai.photo_count > 1 ? `across ${ai.photo_count} photos` : "the photo"} shows ${ai.animal ? `a ${ai.animal}` : "an animal"}`}
        />
        <Factor
          icon={<TriangleAlert size={15} />}
          label="Severity"
          value={ai.severity_weight}
          weight={WEIGHTS.severity}
          detail="As reported: low 25%, medium 50%, high 75%, critical 100%"
        />
        <Factor
          icon={<Users size={15} />}
          label="Reports"
          value={ai.report_weight}
          weight={WEIGHTS.reports}
          detail={`${ai.report_count} ${ai.report_count === 1 ? "person has" : "different people have"} reported it`}
        />
      </ul>

      <div className="score-freshness">
        <Clock size={15} aria-hidden="true" />
        <span>
          <strong>× {freshnessPct}% freshness.</strong>{" "}
          <span className="muted">
            {ai.answered
              ? "Frozen once a team responded."
              : `Waiting ${ai.hours_unanswered} h. Scores fade after 6 h without a response, down to half at 72 h.`}
          </span>
        </span>
      </div>
      <p className="small subtle">Scored by {ai.model} on the report photos.</p>
    </div>
  );
}

export default ScoreBreakdown;
