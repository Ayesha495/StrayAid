import { Link } from "react-router-dom";
import "./Logo.css";

type LogoProps = {
  to?: string;
  inverted?: boolean;
};

// Placeholder mark until the final logo is ready: a paw in a Rescue Green tile.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1E6B56" />
      <g fill="#fff">
        <ellipse cx="16" cy="20.5" rx="5.6" ry="4.6" />
        <ellipse cx="9.4" cy="14.2" rx="2.3" ry="2.9" />
        <ellipse cx="13.4" cy="9.6" rx="2.3" ry="2.9" />
        <ellipse cx="18.6" cy="9.6" rx="2.3" ry="2.9" />
        <ellipse cx="22.6" cy="14.2" rx="2.3" ry="2.9" />
      </g>
    </svg>
  );
}

function Logo({ to = "/", inverted = false }: LogoProps) {
  return (
    <Link to={to} className={`logo${inverted ? " logo-inverted" : ""}`} aria-label="StrayAid home">
      <LogoMark />
      <span>StrayAid</span>
    </Link>
  );
}

export default Logo;
