import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { Animal, Case } from "../types/platform";

type RescueBoardProps = {
  cases: Case[];
  animals: Animal[];
  heading?: string;
  copy?: string;
};

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [30.3753, 69.3451];

function RescueBoard({ cases, animals, heading = "Case Management", copy }: RescueBoardProps) {
  const reportedCases = cases.filter((caseItem) => !caseItem.organization && caseItem.status === "reported");
  const inProgressCases = cases.filter(
    (caseItem) => Boolean(caseItem.organization) && ["assigned", "in_progress"].includes(caseItem.status)
  );
  const rescuedAnimals = animals.filter((animal) => ["rescued", "recovering"].includes(animal.status));
  const adoptionAnimals = animals.filter((animal) => animal.status === "adoptable");

  const mapCenter = reportedCases.length ? [reportedCases[0].latitude, reportedCases[0].longitude] as [number, number] : DEFAULT_CENTER;

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{heading}</h1>
          <p>{copy || "Monitor open reports, active rescues, and the animals currently moving through care and adoption."}</p>
        </div>
      </div>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Reported Cases Map</h2>
            <p className="meta-line">Pins show all reported cases that are still waiting to be accepted by an organization.</p>
          </div>
          <span className="badge">{reportedCases.length} Open Reports</span>
        </div>
        <div className="location-map-shell">
          <MapContainer center={mapCenter} zoom={reportedCases.length ? 11 : 6} scrollWheelZoom className="location-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {reportedCases.map((caseItem) => (
              <Marker key={caseItem.id} position={[caseItem.latitude, caseItem.longitude]} icon={defaultIcon}>
                <Popup>
                  <strong>Case #{caseItem.id}</strong>
                  <div>{caseItem.description}</div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Rescue Workflow</h2>
            <p className="meta-line">Reported and in progress are case stages. Rescued and up for adoption are animal profiles.</p>
          </div>
        </div>

        <div className="category-grid">
          <div className="category-panel">
            <div className="category-header">
              <h3>Reported</h3>
              <span className="badge">{reportedCases.length}</span>
            </div>
            {reportedCases.length ? reportedCases.map((caseItem) => (
              <Link className="status-card" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                <strong>Case #{caseItem.id}</strong>
                <p>{caseItem.description}</p>
              </Link>
            )) : <div className="empty-state compact-state">No unclaimed reported cases.</div>}
          </div>

          <div className="category-panel">
            <div className="category-header">
              <h3>In Progress</h3>
              <span className="badge">{inProgressCases.length}</span>
            </div>
            {inProgressCases.length ? inProgressCases.map((caseItem) => (
              <Link className="status-card" key={caseItem.id} to={`/cases/${caseItem.id}`}>
                <strong>Case #{caseItem.id}</strong>
                <p>{caseItem.description}</p>
              </Link>
            )) : <div className="empty-state compact-state">No active rescue cases right now.</div>}
          </div>

          <div className="category-panel">
            <div className="category-header">
              <h3>Rescued</h3>
              <span className="badge">{rescuedAnimals.length}</span>
            </div>
            {rescuedAnimals.length ? rescuedAnimals.map((animal) => (
              <Link className="status-card" key={animal.id} to={`/animals/${animal.id}`}>
                <strong>{animal.name}</strong>
                <p>{animal.description || "Animal profile ready for care updates."}</p>
              </Link>
            )) : <div className="empty-state compact-state">No rescued animal profiles yet.</div>}
          </div>

          <div className="category-panel">
            <div className="category-header">
              <h3>Up For Adoption</h3>
              <span className="badge">{adoptionAnimals.length}</span>
            </div>
            {adoptionAnimals.length ? adoptionAnimals.map((animal) => (
              <Link className="status-card" key={animal.id} to={`/animals/${animal.id}`}>
                <strong>{animal.name}</strong>
                <p>{animal.description || "Ready for sponsors and adopters."}</p>
              </Link>
            )) : <div className="empty-state compact-state">No animals are up for adoption yet.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RescueBoard;
