import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Clock, Home, Inbox, Mail, MapPin, Navigation, Stethoscope, Truck } from "lucide-react";
import type { Animal, Case, Organization, Report } from "../types/platform";
import ScoreBadge from "../ui/ScoreBadge";
import { byScore } from "../utils/cases";
import { formatRelativeTime } from "../utils/time";
import { formatDuration } from "../utils/format";
import "../styles/CasesWorkflow.css";

type RescueBoardProps = {
  cases: Case[];
  animals?: Animal[];
  heading?: string;
  copy?: string;
  organization?: Organization | null;
};

type KpiTone = "blue" | "amber" | "green" | "purple";

type Kpi = {
  key: string;
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: KpiTone;
};

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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

function daysInCare(dateString: string): number {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function reporterLabel(report?: Report): string {
  if (!report) {
    return "";
  }
  return report.user_email && report.user_email.trim() ? report.user_email : "Anonymous report";
}

function RescueBoard({ cases, animals = [], heading = "Case Management", copy, organization }: RescueBoardProps) {
  // Highest AI priority first, so the most urgent reports are at the top.
  const reportedCases = cases.filter((caseItem) => !caseItem.organization && caseItem.status === "reported").sort(byScore);
  const inProgressCases = cases.filter(
    (caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status)
  );
  const rescuedAnimals = animals.filter((animal) => ["rescued", "recovering"].includes(animal.status));
  const adoptionAnimals = animals.filter((animal) => animal.status === "adoptable");
  const previewItems = <T,>(items: T[]) => items.slice(0, 3);

  const mapCenter = reportedCases.length ? [reportedCases[0].latitude, reportedCases[0].longitude] as [number, number] : DEFAULT_CENTER;

  const claimedCases = cases.filter((caseItem) => Boolean(caseItem.organization) && caseItem.status !== "reported");
  const avgResponseMinutes = claimedCases.length
    ? claimedCases.reduce((total, caseItem) => {
        const created = new Date(caseItem.created_at).getTime();
        const updated = new Date(caseItem.updated_at).getTime();
        return total + (updated - created) / 60000;
      }, 0) / claimedCases.length
    : null;
  const avgResponseLabel = avgResponseMinutes === null ? "N/A" : formatDuration(avgResponseMinutes);

  const kpis: Kpi[] = [
    { key: "pending", label: "Pending Claim", value: reportedCases.length, icon: <Inbox size={18} />, tone: "blue" },
    { key: "transit", label: "In Transit", value: inProgressCases.length, icon: <Truck size={18} />, tone: "amber" },
    { key: "clinic", label: "Clinic / Recovery", value: rescuedAnimals.length, icon: <Stethoscope size={18} />, tone: "green" },
    { key: "adoption", label: "Adoption Ready", value: adoptionAnimals.length, icon: <Home size={18} />, tone: "purple" },
    { key: "response", label: "Avg Response", value: avgResponseLabel, icon: <Clock size={18} />, tone: "blue" },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{heading}</h1>
          <p>{copy || "Monitor open reports, active rescues, and the animals currently moving through care and adoption."}</p>
        </div>
      </div>

      <div className="cases-kpi-strip">
        {kpis.map((kpi) => (
          <div className={`cases-kpi-chip cases-kpi-chip-${kpi.tone}`} key={kpi.key}>
            <span className="cases-kpi-icon">{kpi.icon}</span>
            <div>
              <p className="cases-kpi-label">{kpi.label}</p>
              <p className="cases-kpi-value">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="panel-card">
        <div className="section-heading">
          <div className="cases-heading-row">
            <span className="cases-heading-icon cases-heading-icon-blue">
              <MapPin size={18} />
            </span>
            <div>
              <h2>Reported Cases Map</h2>
              <p className="meta-line">Pins show all reported cases that are still waiting to be accepted by an organization.</p>
            </div>
          </div>
          <span className="badge badge-blue">{reportedCases.length} Open Reports</span>
        </div>
        <div className="location-map-shell">
          <MapContainer center={mapCenter} zoom={reportedCases.length ? 11 : 6} scrollWheelZoom className="location-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToCases cases={reportedCases} organization={organization} />
            {hasLocation(organization) && organization.radius ? (
              <Circle
                center={[organization.latitude, organization.longitude]}
                radius={organization.radius * 1000}
                pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.06 }}
              />
            ) : null}
            {hasLocation(organization) ? (
              <CircleMarker
                center={[organization.latitude, organization.longitude]}
                radius={7}
                pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
              >
                <Popup>Your base: {organization.name}</Popup>
              </CircleMarker>
            ) : null}
            {reportedCases.map((caseItem) => (
              <Marker key={caseItem.id} position={[caseItem.latitude, caseItem.longitude]} icon={defaultIcon}>
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
        </div>
        <p className="map-footnote">
          <Navigation size={14} /> {reportedCases.length} pending pickup
        </p>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Rescue Workflow</h2>
            <p className="meta-line">A quick status view of your active rescue pipeline from intake to adoption readiness.</p>
          </div>
        </div>

        <div className="workflow-grid">
          <div className="category-panel category-panel-blue">
            <div className="category-header">
              <div className="cases-heading-row">
                <span className="cases-heading-icon cases-heading-icon-blue">
                  <Inbox size={16} />
                </span>
                <h3>Reported</h3>
              </div>
              <span className="badge badge-blue">{reportedCases.length}</span>
            </div>
            {previewItems(reportedCases).length ? previewItems(reportedCases).map((caseItem) => {
              const report = caseItem.reports[0];
              return (
                <Link className="status-card status-card-blue" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                  <strong>Case #{caseItem.id}</strong> <ScoreBadge score={caseItem.confidence_score} compact />
                  <p>{caseItem.description}</p>
                  <p className="status-card-meta">Reported {formatRelativeTime(caseItem.created_at)}</p>
                  {report ? (
                    <p className="status-card-meta">
                      <Mail size={12} /> {reporterLabel(report)}
                    </p>
                  ) : null}
                </Link>
              );
            }) : <div className="empty-state compact-state">No unclaimed reported cases.</div>}
            {reportedCases.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/reported">More reported cases</Link> : null}
          </div>

          <div className="category-panel category-panel-amber">
            <div className="category-header">
              <div className="cases-heading-row">
                <span className="cases-heading-icon cases-heading-icon-amber">
                  <Truck size={16} />
                </span>
                <h3>In Progress</h3>
              </div>
              <span className="badge badge-amber">{inProgressCases.length}</span>
            </div>
            {previewItems(inProgressCases).length ? previewItems(inProgressCases).map((caseItem) => {
              const report = caseItem.reports[0];
              return (
                <Link className="status-card status-card-amber" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                  <strong>Case #{caseItem.id}</strong>
                  <p>{caseItem.description}</p>
                  <p className="status-card-meta">Updated {formatRelativeTime(caseItem.updated_at)}</p>
                  {report ? (
                    <p className="status-card-meta">
                      <Mail size={12} /> {reporterLabel(report)}
                    </p>
                  ) : null}
                </Link>
              );
            }) : <div className="empty-state compact-state">No active rescue cases right now.</div>}
            {inProgressCases.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/in-progress">More in progress</Link> : null}
          </div>

          <div className="category-panel category-panel-green">
            <div className="category-header">
              <div className="cases-heading-row">
                <span className="cases-heading-icon cases-heading-icon-green">
                  <Stethoscope size={16} />
                </span>
                <h3>Rescued</h3>
              </div>
              <span className="badge badge-green">{rescuedAnimals.length}</span>
            </div>
            {previewItems(rescuedAnimals).length ? previewItems(rescuedAnimals).map((animal) => {
              const days = daysInCare(animal.created_at);
              return (
                <Link className="status-card status-card-green" key={animal.id} to={`/animals/${animal.id}`}>
                  <strong>{animal.name}</strong>
                  <p>{animal.description || "Animal profile ready for care updates."}</p>
                  <p className="status-card-meta">
                    {days === 0 ? "Added today" : `${days} day${days === 1 ? "" : "s"} in care`}
                  </p>
                </Link>
              );
            }) : <div className="empty-state compact-state">No rescued animal profiles yet.</div>}
            {rescuedAnimals.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/rescued">More rescued animals</Link> : null}
          </div>

          <div className="category-panel category-panel-purple">
            <div className="category-header">
              <div className="cases-heading-row">
                <span className="cases-heading-icon cases-heading-icon-purple">
                  <Home size={16} />
                </span>
                <h3>Up For Adoption</h3>
              </div>
              <span className="badge badge-purple">{adoptionAnimals.length}</span>
            </div>
            {previewItems(adoptionAnimals).length ? previewItems(adoptionAnimals).map((animal) => (
              <Link className="status-card status-card-purple" key={animal.id} to={`/animals/${animal.id}`}>
                <strong>{animal.name}</strong>
                <p>{animal.description || "Ready for sponsors and adopters."}</p>
                <p className="status-card-meta">Listed {formatRelativeTime(animal.created_at)}</p>
              </Link>
            )) : <div className="empty-state compact-state">No animals are up for adoption yet.</div>}
            {adoptionAnimals.length > 3 ? <Link className="inline-link workflow-more-link" to="/dashboard/workflow/adoptable">More adoptable animals</Link> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RescueBoard;
