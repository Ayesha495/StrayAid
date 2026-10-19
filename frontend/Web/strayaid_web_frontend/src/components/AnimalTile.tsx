import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PawPrint } from "lucide-react";
import StatusChip from "../ui/StatusChip";
import FundingMeter from "./FundingMeter";
import type { Animal } from "../types/platform";
import "./AnimalTile.css";

/** An animal card for grids: photo, name, breed, status and sponsorship progress. */
function AnimalTile({ animal, to = `/animals/${animal.id}`, actions, showOrganization = false }: {
  animal: Animal;
  to?: string;
  actions?: ReactNode;
  showOrganization?: boolean;
}) {
  const details = [animal.species, animal.breed, animal.age !== null && animal.age !== undefined ? `${animal.age} yr` : "", animal.gender]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="card animal-tile">
      <Link to={to} className="animal-tile-photo">
        {animal.image ? <img src={animal.image} alt={animal.name} loading="lazy" /> : <PawPrint size={28} />}
        <span className="animal-tile-status"><StatusChip kind="animal" value={animal.status} /></span>
      </Link>
      <div className="animal-tile-body">
        <Link to={to} className="animal-tile-name">{animal.name}</Link>
        <span className="small muted truncate">{details || "Details not added yet"}</span>
        {showOrganization && animal.organization ? <span className="small muted truncate">{animal.organization.name}</span> : null}
        {animal.funding_goal_pkr && animal.status !== "adopted" ? (
          <div className="animal-tile-sponsors">
            <FundingMeter raised={animal.raised_pkr ?? 0} goal={animal.funding_goal_pkr} size="sm" />
          </div>
        ) : null}
      </div>
      {actions ? <div className="animal-tile-actions">{actions}</div> : null}
    </article>
  );
}

export default AnimalTile;
