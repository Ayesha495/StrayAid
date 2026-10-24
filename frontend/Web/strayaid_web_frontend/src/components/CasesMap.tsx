import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Circle, CircleMarker, MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Case, Organization } from "../types/platform";
import ScoreBadge from "../ui/ScoreBadge";
import MapTiles from "./map/MapTiles";
import { areaPathOptions, basePathOptions, casePin } from "./map/mapStyle";

const DEFAULT_CENTER: [number, number] = [30.3753, 69.3451];

function hasLocation(organization?: Organization | null): organization is Organization {
  return Boolean(organization && Number.isFinite(organization.latitude) && Number.isFinite(organization.longitude));
}

// MapContainer only reads `center` and `zoom` when it first mounts, but cases arrive later.
// Re-frame the map around the pins (and the organization's service area) whenever they change.
function FitToCases({ cases, organization }: { cases: Case[]; organization?: Organization | null }) {
  const map = useMap();
  const pinKey = cases.map((caseItem) => `${caseItem.id}:${caseItem.latitude},${caseItem.longitude}`).join("|");
  const orgKey = hasLocation(organization) ? `${organization.latitude},${organization.longitude},${organization.radius ?? 0}` : "";

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    cases.forEach((caseItem) => bounds.extend([caseItem.latitude, caseItem.longitude]));
    if (hasLocation(organization)) {
      const home = L.latLng(organization.latitude, organization.longitude);
      bounds.extend(organization.radius ? home.toBounds(organization.radius * 2000) : home);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // pinKey and orgKey capture everything the bounds depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pinKey, orgKey]);

  return null;
}

type CasesMapProps = {
  cases: Case[];
  organization?: Organization | null;
  className?: string;
};

/** Open reports as severity pins, with the team's base and service area for context. */
function CasesMap({ cases, organization, className = "location-map" }: CasesMapProps) {
  const center: [number, number] = cases.length ? [cases[0].latitude, cases[0].longitude] : DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={cases.length ? 11 : 6} scrollWheelZoom={false} className={className}>
      <MapTiles />
      <FitToCases cases={cases} organization={organization} />
      {hasLocation(organization) && organization.radius ? (
        <Circle center={[organization.latitude, organization.longitude]} radius={organization.radius * 1000} pathOptions={areaPathOptions} />
      ) : null}
      {hasLocation(organization) ? (
        <CircleMarker center={[organization.latitude, organization.longitude]} radius={7} pathOptions={basePathOptions()}>
          <Popup>Your base: {organization.name}</Popup>
        </CircleMarker>
      ) : null}
      {cases.map((caseItem) => (
        <Marker key={caseItem.id} position={[caseItem.latitude, caseItem.longitude]} icon={casePin(caseItem.severity)}>
          <Popup>
            <strong>Case #{caseItem.id}</strong>{" "}
            <ScoreBadge score={caseItem.confidence_score} compact />
            <div>{caseItem.description}</div>
            <div style={{ marginTop: "8px" }}>
              <Link className="inline-link" to={`/cases/${caseItem.id}`}>View case details</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default CasesMap;
