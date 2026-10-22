import { MapContainer, Marker, Popup } from "react-leaflet";
import { X } from "lucide-react";
import { MapTiles, placePin } from "./map/mapLook";

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
            <MapTiles />
            <Marker position={[latitude, longitude]} icon={placePin}>
              <Popup>Case #R-{caseId}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default CaseLocationModal;
