import { Circle, CircleMarker, MapContainer } from "react-leaflet";
import { MapTiles, areaPathOptions, basePathOptions } from "./map/mapLook";

/** Where an organization is based and how far it travels for rescues. */
function ServiceAreaMap({ latitude, longitude, radiusKm, label }: { latitude: number; longitude: number; radiusKm?: number; label: string }) {
  // Zoom so the whole service circle fits a ~300px wide card.
  const zoom = !radiusKm ? 13 : radiusKm > 25 ? 8 : radiusKm > 12 ? 9 : radiusKm > 6 ? 10 : 11;
  return (
    <div className="service-map" role="img" aria-label={label}>
      <MapContainer center={[latitude, longitude]} zoom={zoom} scrollWheelZoom={false} zoomControl={false} dragging={false} style={{ height: "100%" }}>
        <MapTiles />
        {radiusKm ? <Circle center={[latitude, longitude]} radius={radiusKm * 1000} pathOptions={areaPathOptions} /> : null}
        <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={basePathOptions()} />
      </MapContainer>
    </div>
  );
}

export default ServiceAreaMap;
