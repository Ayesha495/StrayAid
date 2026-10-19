import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { formatPkr } from "../utils/format";
import "./FundingMeter.css";

type FundingMeterProps = {
  raised: number;
  goal: number;
  /** e.g. "raised for Luna's care" */
  caption?: string;
  supporters?: number;
  size?: "lg" | "sm";
};

const MILESTONES = [25, 50, 75];

/**
 * Money raised against a goal, in rupees: the three numbers donors look for (raised, goal,
 * percent), milestone ticks, and a fill that animates in once (off for reduced motion,
 * because it animates a transform).
 */
function FundingMeter({ raised, goal, caption = "raised", supporters, size = "lg" }: FundingMeterProps) {
  // Watch the track (the fill starts at zero width, which never counts as "in view").
  const trackRef = useRef<HTMLDivElement>(null);
  const inView = useInView(trackRef, { once: true });
  if (!goal) {
    return <p className="funding-empty">No funding goal set yet.</p>;
  }
  const percent = Math.min(100, Math.round((raised / goal) * 100));
  const remaining = Math.max(0, goal - raised);
  const funded = raised >= goal;

  return (
    <div className={`funding funding-${size}${funded ? " is-funded" : ""}`}>
      <div className="funding-numbers">
        <span className="funding-raised">{formatPkr(raised)}</span>
        <span className="funding-goal">{caption} of {formatPkr(goal)}</span>
      </div>
      <div
        ref={trackRef}
        className="funding-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(raised, goal)}
        aria-valuetext={`${formatPkr(raised)} of ${formatPkr(goal)}, ${percent}%`}
      >
        <motion.span
          className="funding-fill"
          style={{ width: `${percent}%`, originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: inView ? 1 : 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {MILESTONES.map((mark) => (
          <span key={mark} className={`funding-tick${percent >= mark ? " is-reached" : ""}`} style={{ left: `${mark}%` }} aria-hidden="true" />
        ))}
      </div>
      <div className="funding-meta">
        <span><strong>{percent}%</strong> funded</span>
        {supporters !== undefined ? <span>{supporters} {supporters === 1 ? "supporter" : "supporters"}</span> : null}
        <span>{funded ? "Goal reached, thank you!" : `${formatPkr(remaining)} to go`}</span>
      </div>
    </div>
  );
}

export default FundingMeter;
