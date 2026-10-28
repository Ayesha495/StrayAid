import { AlertTriangle, Award, Check, CheckCircle2, Info, Star, X } from "lucide-react";
import StatusChip from "../ui/StatusChip";
import { formatDate } from "../utils/format";
import { CRITERIA, rankApplicants, scoreLabel, type ApplicantMatch } from "../utils/adoptionMatch";
import type { AdoptionApplication } from "../types/api";

/**
 * Compare everyone who applied for one animal: a verdict (who's the suggested match, or who
 * was approved), a ranked chart of match scores, and the answers side by side with the best
 * answer in each row marked. Built on utils/adoptionMatch.ts.
 */

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? "Not said" : value ? "Yes" : "No");

const firstName = (name: string) => name.split(" ")[0] || name;

/** Info shown for context but not scored: whether it helps depends on the animal. */
const DETAILS: Array<[label: string, read: (a: AdoptionApplication) => string]> = [
  ["Children at home", (a) => yesNo(a.has_children)],
  ["Other pets", (a) => yesNo(a.has_other_pets)],
  ["Household", (a) => (a.household_size ? `${a.household_size} ${a.household_size === 1 ? "person" : "people"}` : "Not said")],
  ["City", (a) => a.city || "Not said"],
  ["Applied", (a) => formatDate(a.created_at)],
];

function breakdownText(match: ApplicantMatch) {
  return match.criteria.map((item) => `${item.label}: ${item.points}/${item.weight}`).join(" · ");
}

/** A 0-1 fill on a lighter track of the same hue. */
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <span className="match-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <span className="match-meter-fill" style={{ width: `${Math.max(value, 0.02) * 100}%` }} />
    </span>
  );
}

export function RequirementsChip({ match }: { match: ApplicantMatch }) {
  const missing = match.requirements.filter((item) => !item.met).length;
  return missing ? (
    <span className="match-req is-missing" title={match.requirements.filter((item) => !item.met).map((item) => item.label).join(", ")}>
      <AlertTriangle size={13} aria-hidden /> Missing {missing} requirement{missing === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="match-req is-met">
      <CheckCircle2 size={13} aria-hidden /> Meets requirements
    </span>
  );
}

/** One applicant's score and the criteria behind it (the detail pane uses this too). */
export function MatchBreakdown({ match }: { match: ApplicantMatch }) {
  return (
    <div className="match-breakdown">
      <div className="match-breakdown-head">
        <div>
          <div className="match-score-big">
            {match.score}
            <span>/100</span>
          </div>
          <div className="small muted">{scoreLabel(match.score)}</div>
        </div>
        <RequirementsChip match={match} />
      </div>
      <ul className="match-criteria">
        {match.criteria.map((item) => (
          <li key={item.key} title={item.hint}>
            <span className="match-criteria-label">{item.label}</span>
            <Meter value={item.value} label={`${item.label}: ${item.points} of ${item.weight} points`} />
            <span className="match-criteria-points">
              {item.points}/{item.weight}
            </span>
            <span className="small muted match-criteria-answer">{item.answer}</span>
          </li>
        ))}
      </ul>
      {match.requirements.some((item) => !item.met) ? (
        <ul className="match-missing">
          {match.requirements
            .filter((item) => !item.met)
            .map((item) => (
              <li key={item.key}>
                <X size={13} aria-hidden /> {item.label}: {item.detail.toLowerCase()}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ApplicantComparison({
  animalName,
  applications,
  onPick,
}: {
  animalName: string;
  applications: AdoptionApplication[];
  onPick: (id: number) => void;
}) {
  const { ranked, topMatchId, approvedId, bestByCriterion } = rankApplicants(applications);
  const top = ranked.find((match) => match.application.id === topMatchId) ?? null;
  const approved = ranked.find((match) => match.application.id === approvedId) ?? null;
  const runnerUp = top ? ranked.find((match) => match !== top && match.application.status === "pending" && match.meetsRequirements) : null;

  return (
    <div className="compare">
      {approved ? (
        <div className="match-verdict is-approved" role="status">
          <CheckCircle2 size={20} aria-hidden />
          <div>
            <strong>{approved.application.full_name} was approved.</strong> {animalName} is adopted, so the other applications are closed.
          </div>
        </div>
      ) : top ? (
        <div className="match-verdict is-suggested" role="status">
          <Award size={20} aria-hidden />
          <div>
            <strong>Suggested: {top.application.full_name}</strong> with {top.score}/100 ({scoreLabel(top.score).toLowerCase()})
            {runnerUp ? `, ${top.score - runnerUp.score} points ahead of ${firstName(runnerUp.application.full_name)}` : ""}. They meet every
            requirement. Review their answers, then approve if you agree.
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onPick(top.application.id)}>
            Review {firstName(top.application.full_name)}
          </button>
        </div>
      ) : (
        <div className="match-verdict is-blocked" role="status">
          <AlertTriangle size={20} aria-hidden />
          <div>
            <strong>No open applicant meets every requirement yet.</strong> Message them to confirm the missing answers (for
            example, landlord permission) before deciding.
          </div>
        </div>
      )}

      <section aria-labelledby="match-ranking-title">
        <h3 id="match-ranking-title" className="compare-heading">
          Match score
        </h3>
        <p className="small muted compare-sub">
          Out of 100, from time together, experience, home fit and how thoughtful the answers are. Requirements are checked
          separately. Hover a bar for the breakdown.
        </p>
        <ol className="match-ranking">
          {ranked.map((match) => {
            const { application } = match;
            const closed = application.status === "rejected" || application.status === "withdrawn";
            return (
              <li key={application.id} className={`match-rank${closed ? " is-closed" : ""}${application.id === topMatchId ? " is-top" : ""}`}>
                <div className="match-rank-who">
                  <button type="button" className="link" onClick={() => onPick(application.id)}>
                    {application.full_name}
                  </button>
                  {application.id === topMatchId ? (
                    <span className="match-badge">
                      <Star size={12} aria-hidden /> Top match
                    </span>
                  ) : null}
                  <StatusChip kind="review" value={application.status} />
                </div>
                <div className="match-rank-bar" title={breakdownText(match)}>
                  <span className="match-bar-track">
                    <span className="match-bar-fill" style={{ width: `${match.score}%` }} />
                  </span>
                  <span className="match-bar-value">
                    <strong>{match.score}</strong> <span className="muted">{scoreLabel(match.score)}</span>
                  </span>
                </div>
                <RequirementsChip match={match} />
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="match-table-title">
        <h3 id="match-table-title" className="compare-heading">
          Side by side
        </h3>
        <div className="table-wrap compare-wrap">
          <table className="table compare-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Criterion</span>
                </th>
                {ranked.map(({ application }) => (
                  <th scope="col" key={application.id} className={application.id === topMatchId ? "is-top" : undefined}>
                    <button type="button" className="link" onClick={() => onPick(application.id)}>
                      {application.full_name}
                    </button>
                    <div className="compare-head-chips">
                      {application.id === topMatchId ? (
                        <span className="match-badge">
                          <Star size={12} aria-hidden /> Top match
                        </span>
                      ) : null}
                      <StatusChip kind="review" value={application.status} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="compare-group">
                <th scope="colgroup" colSpan={ranked.length + 1}>
                  Match criteria
                </th>
              </tr>
              {CRITERIA.map((criterion, index) => (
                <tr key={criterion.key}>
                  <th scope="row" title={criterion.hint}>
                    {criterion.label}
                    <span className="compare-weight">up to {criterion.weight} pts</span>
                  </th>
                  {ranked.map((match) => {
                    const item = match.criteria[index];
                    const best = bestByCriterion[criterion.key]?.includes(match.application.id);
                    return (
                      <td key={match.application.id} className={match.application.id === topMatchId ? "is-top" : undefined}>
                        <div className="compare-cell">
                          <span>{item.answer}</span>
                          <span className="compare-cell-meter">
                            <Meter value={item.value} label={`${item.label}: ${item.points} of ${item.weight} points`} />
                            <span className="compare-points">
                              {item.points}/{item.weight}
                            </span>
                          </span>
                          {best ? (
                            <span className="compare-best">
                              <Check size={12} aria-hidden /> Best
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="compare-total">
                <th scope="row">Match score</th>
                {ranked.map((match) => (
                  <td key={match.application.id} className={match.application.id === topMatchId ? "is-top" : undefined}>
                    <strong>{match.score}</strong>/100 <span className="small muted">{scoreLabel(match.score)}</span>
                  </td>
                ))}
              </tr>

              <tr className="compare-group">
                <th scope="colgroup" colSpan={ranked.length + 1}>
                  Requirements (must all be met)
                </th>
              </tr>
              {["home_visit", "return_policy", "landlord"].map((key) => {
                const label = ranked.flatMap((match) => match.requirements).find((item) => item.key === key)?.label;
                if (!label) return null;
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    {ranked.map((match) => {
                      const requirement = match.requirements.find((item) => item.key === key);
                      return (
                        <td key={match.application.id} className={match.application.id === topMatchId ? "is-top" : undefined}>
                          {!requirement ? (
                            <span className="muted">Not renting</span>
                          ) : requirement.met ? (
                            <span className="compare-yes">
                              <Check size={14} aria-hidden /> {requirement.detail}
                            </span>
                          ) : (
                            <span className="compare-no">
                              <X size={14} aria-hidden /> {requirement.detail}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              <tr className="compare-group">
                <th scope="colgroup" colSpan={ranked.length + 1}>
                  Other details (not scored: depends on {animalName})
                </th>
              </tr>
              {DETAILS.map(([label, read]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {ranked.map(({ application }) => (
                    <td key={application.id} className={application.id === topMatchId ? "is-top" : undefined}>
                      {read(application)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="small muted compare-note">
        <Info size={13} aria-hidden /> The match score is a guide from the application answers. Your team makes the final
        decision, ideally after a conversation and a home visit.
      </p>
    </div>
  );
}
