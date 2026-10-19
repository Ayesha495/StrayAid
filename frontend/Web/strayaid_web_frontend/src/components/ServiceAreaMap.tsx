import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/** Where an organization is based and how far it travels for rescues. */
function ServiceAreaMap({ latitude, longitude, radiusKm, label }: { latitude: number; longitude: number; radiusKm?: number; label: string }) {
  // Zoom so the whole service circle fits a ~300px wide card.
  const zoom = !radiusKm ? 13 : radiusKm > 25 ? 8 : radiusKm > 12 ? 9 : radiusKm > 6 ? 10 : 11;
  return (
    <div className="service-map" role="img" aria-label={label}>
      <MapContainer center={[latitude, longitude]} zoom={zoom} scrollWheelZoom={false} zoomControl={false} dragging={false} style={{ height: "100%" }}>
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
        {radiusKm ? <Circle center={[latitude, longitude]} radius={radiusKm * 1000} pathOptions={{ color: "#1e6b56", weight: 1.5, fillOpacity: 0.08 }} /> : null}
        <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={{ color: "#fff", weight: 2, fillColor: "#1e6b56", fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}

export default ServiceAreaMap;
