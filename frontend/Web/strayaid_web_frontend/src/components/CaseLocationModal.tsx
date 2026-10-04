import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { X } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type CaseLocationModalProps = {
  caseId: number;
  description: string;
  latitude: number;
  longitude: number;
  onClose: () => void;
};

function CaseLocationModal({ caseId, description, latitude, longitude, onClose }: CaseLocationModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card case-location-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Case #R-{caseId}</p>
            <h2>Case Location</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close map">
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">{description}</p>
        <div className="location-map-shell case-location-map-shell">
          <MapContainer center={[latitude, longitude]} zoom={14} scrollWheelZoom={false} className="location-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude, longitude]} icon={defaultIcon}>
              <Popup>Case #R-{caseId}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default CaseLocationModal;
