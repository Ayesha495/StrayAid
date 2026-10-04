import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Building2, Camera, Clock, FileText, MapPin, Ruler, Send } from "lucide-react";
import SafeImage from "../components/SafeImage";
import { acceptCase, getCase, updateCaseStatus } from "../services/platformService";
import type { Case } from "../types/platform";
import { caseLabel } from "../utils/identifiers";
import { statusBadgeClass } from "../utils/status";
import { formatRelativeTime } from "../utils/time";
import "../styles/Portal.css";
import "../styles/PublicProfile.css";

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function CaseDetail() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<Case | null>(null);

  useEffect(() => {
    getCase(caseId).then(setCaseItem).catch(() => setCaseItem(null));
  }, [caseId]);

  const handleAccept = async () => {
    const updated = await acceptCase(caseId);
    setCaseItem(updated);
  };

  const handleStatusChange = async (status: string) => {
    const updated = await updateCaseStatus(caseId, status);
    setCaseItem(updated);
    if (status === "rescued") {
      navigate(`/animals?caseId=${caseId}`);
    }
  };

  if (!caseItem) {
    return <div className="empty-state">Case not found or unavailable for this organization.</div>;
  }

  const hasCoordinates =
    Number.isFinite(caseItem.latitude) &&
    Number.isFinite(caseItem.longitude) &&
    (caseItem.latitude !== 0 || caseItem.longitude !== 0);
  const mapCenter: [number, number] = [caseItem.latitude, caseItem.longitude];

  const facts = [
    { key: "status", label: "Status", value: caseItem.status.replace("_", " "), icon: <FileText size={16} />, tone: "blue" },
    { key: "reported", label: "Reported", value: formatRelativeTime(caseItem.created_at), icon: <Clock size={16} />, tone: "amber" },
    { key: "organization", label: "Assigned Organization", value: caseItem.organization?.name || "Unclaimed", icon: <Building2 size={16} />, tone: "purple" },
    { key: "distance", label: "Distance", value: caseItem.distance_km != null ? `${caseItem.distance_km.toFixed(1)} km away` : "Not available", icon: <Ruler size={16} />, tone: "gray" },
    { key: "reports", label: "Reports", value: `${caseItem.reports.length} submitted`, icon: <Camera size={16} />, tone: "green" },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>{caseLabel(caseItem.id)}</h1>
          <p>{caseItem.description}</p>
        </div>
        <span className={statusBadgeClass(caseItem.status)}>{caseItem.status}</span>
      </div>

      <section className="public-stat-strip">
        {facts.map((fact) => (
          <div className="public-stat-chip" key={fact.key}>
            <span className={`public-stat-icon public-stat-icon-${fact.tone}`}>{fact.icon}</span>
            <div className="public-stat-body">
              <p className="public-stat-label">{fact.label}</p>
              <p className="public-stat-value">{fact.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="panel-card">
        <div className="section-heading section-heading-center">
          <div className="cases-heading-row">
            <span className="cases-heading-icon cases-heading-icon-blue">
              <Send size={18} />
            </span>
            <div>
              <h2>Rescue Actions</h2>
              <p className="meta-line">Claim this case or move it through the rescue pipeline.</p>
            </div>
          </div>
          <div className="case-actions">
            {!caseItem.organization && <button className="btn btn-primary" onClick={handleAccept}>Accept Case</button>}
            {caseItem.organization && ["in_progress", "rescued", "closed"].map((status) => (
              <button key={status} className="btn btn-secondary" onClick={() => handleStatusChange(status)}>
                Mark {status.replace("_", " ")}
              </button>
            ))}
            {caseItem.status === "rescued" && <Link className="btn btn-primary" to={`/animals?caseId=${caseItem.id}`}>Create Animal Profile</Link>}
          </div>
        </div>
      </section>

      {hasCoordinates ? (
        <section className="panel-card">
          <div className="section-heading">
            <div className="cases-heading-row">
              <span className="cases-heading-icon cases-heading-icon-blue">
                <MapPin size={18} />
              </span>
              <div>
                <h2>Reported Location</h2>
                <p className="meta-line">Where this case was reported.</p>
              </div>
            </div>
          </div>
          <div className="location-map-shell">
            <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={false} className="location-map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={mapCenter} icon={defaultIcon} />
            </MapContainer>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="section-heading">
          <div className="cases-heading-row">
            <span className="cases-heading-icon cases-heading-icon-green">
              <Camera size={18} />
            </span>
            <div>
              <h2>Attached Reports</h2>
              <p className="meta-line">{caseItem.reports.length} report{caseItem.reports.length === 1 ? "" : "s"} submitted for this case.</p>
            </div>
          </div>
        </div>
        <div className="stacked-feed">
          {caseItem.reports.map((report, index) => (
            <article className="feed-card" key={report.id}>
              <SafeImage
                src={report.image}
                alt="Case report"
                className="card-media report-media-fit"
                fallback={<Camera size={28} />}
                fallbackClassName="card-media report-media-fit media-placeholder"
              />
              <p className="meta-line">Report #{index + 1}</p>
              <p>{report.description}</p>
              <p className="meta-line">{report.user_email ?? "Anonymous reporter"} · {formatRelativeTime(report.created_at)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CaseDetail;
