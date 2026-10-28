import { Camera, Clock, Gauge, UserCheck, Users } from "lucide-react";
import type { CaseAi } from "../types/api";
import { scoreTone } from "../utils/format";
import "./ScoreBreakdown.css";

// Mirrors backend/rescue/utils/scoring.py:
//   score = round(100 × (0.5·photo + 0.3·community + 0.2·reports) × freshness)
// "community" is people nearby answering "Is this animal still there?" on the mobile app.
const WEIGHTS = { photo: 0.5, community: 0.3, reports: 0.2 };

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
          icon={<UserCheck size={15} />}
          label="Community verification"
          value={ai.community_weight}
          weight={WEIGHTS.community}
          detail={
            ai.confirmations + ai.disputes
              ? `${ai.confirmations} confirmed the animal is there, ${ai.disputes} couldn't find it`
              : "Nobody nearby has verified it yet (counts as neutral)"
          }
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
