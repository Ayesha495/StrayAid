import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Maximize2, MapPin, Minimize2 } from "lucide-react";
import type { Case } from "../types/platform";
import { caseLabel } from "../utils/identifiers";
import "../styles/CasesMap.css";

const DEFAULT_CENTER: [number, number] = [30.3753, 69.3451];

const REPORTED_PIN_COLOR = "#1c3a2e";

const reportedPinIcon = L.divIcon({
  className: "cases-map-pin",
  html: `<span class="cases-map-pin-dot" style="background:${REPORTED_PIN_COLOR}"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

function MapResizeHandler({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [trigger, map]);

  // The card can resize without a window resize (browser zoom reflow, sidebar
  // toggle, flex wrapping), which Leaflet doesn't detect on its own.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type CasesMapProps = {
  cases: Case[];
  compact?: boolean;
};

function CasesMap({ cases, compact = false }: CasesMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const pinnedCases = cases.filter(
    (caseItem) =>
      caseItem.status === "reported" &&
      typeof caseItem.latitude === "number" &&
      typeof caseItem.longitude === "number"
  );
  const mapCenter: [number, number] = pinnedCases.length
    ? [pinnedCases[0].latitude, pinnedCases[0].longitude]
    : DEFAULT_CENTER;

  return (
    <>
      {isFullscreen ? <div className="cases-map-backdrop" onClick={() => setIsFullscreen(false)} /> : null}
      <section
        className={`panel-card cases-map-card${compact ? " cases-map-card--compact" : ""}${isFullscreen ? " is-fullscreen" : ""}`}
      >
        <div className="section-heading">
          <div className="cases-heading-row">
            <span className="cases-heading-icon cases-heading-icon-blue">
              <MapPin size={18} />
            </span>
            <div>
              <h2>Reported Cases Map</h2>
              <p className="meta-line">
                {pinnedCases.length} unclaimed report{pinnedCases.length === 1 ? "" : "s"} in your operational radius.
              </p>
            </div>
          </div>
          <div className="cases-map-header-actions">
            <span className="badge badge-blue">{pinnedCases.length} Open Report{pinnedCases.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={isFullscreen ? "Exit fullscreen map" : "View map fullscreen"}
              onClick={() => setIsFullscreen((value) => !value)}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        <div className={`location-map-shell cases-map-shell${isFullscreen ? " is-fullscreen" : ""}`}>
          {pinnedCases.length ? (
            <MapContainer
              center={mapCenter}
              zoom={pinnedCases.length > 1 ? 11 : 13}
              minZoom={3}
              maxZoom={18}
              scrollWheelZoom
              className="location-map cases-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapResizeHandler trigger={isFullscreen} />
              {pinnedCases.map((caseItem) => (
                <Marker key={caseItem.id} position={[caseItem.latitude, caseItem.longitude]} icon={reportedPinIcon}>
                  <Popup>
                    <strong>{caseLabel(caseItem.id)}</strong>
                    <div>{caseItem.description}</div>
                    {caseItem.distance_km != null ? (
                      <div className="cases-map-popup-status">{caseItem.distance_km.toFixed(1)} km away</div>
                    ) : null}
                    <div style={{ marginTop: "8px" }}>
                      <Link className="link" to={`/cases/${caseItem.id}`}>
                        View case details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="empty-state compact-state">
              <MapPin size={16} /> No reported cases in your operational radius right now.
            </div>
          )}
        </div>
        {pinnedCases.length ? (
          <p className="map-footnote">
            <MapPin size={14} /> {pinnedCases.length} pending pickup
          </p>
        ) : null}
      </section>
    </>
  );
}

export default CasesMap;
