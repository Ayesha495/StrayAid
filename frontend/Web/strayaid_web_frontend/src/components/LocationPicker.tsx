import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L, { type LatLngExpression, type LeafletMouseEvent } from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type LocationPickerProps = {
  latitude: number;
  longitude: number;
  address: string;
  onLocationChange: (next: { latitude: number; longitude: number }) => void;
  onAddressChange: (address: string) => void;
};

const DEFAULT_CENTER: LatLngExpression = [30.3753, 69.3451];

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RecenterMap({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMapEvents({});

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

function LocationPicker({
  latitude,
  longitude,
  address,
  onLocationChange,
  onAddressChange,
}: LocationPickerProps) {
  const [manualLatitude, setManualLatitude] = useState(latitude ? latitude.toFixed(6) : "");
  const [manualLongitude, setManualLongitude] = useState(longitude ? longitude.toFixed(6) : "");
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);
  const center: LatLngExpression = hasCoordinates ? [latitude, longitude] : DEFAULT_CENTER;

  useEffect(() => {
    setManualLatitude(hasCoordinates ? latitude.toFixed(6) : "");
    setManualLongitude(hasCoordinates ? longitude.toFixed(6) : "");
  }, [hasCoordinates, latitude, longitude]);

  const updateLocation = (nextLatitude: number, nextLongitude: number) => {
    onLocationChange({ latitude: nextLatitude, longitude: nextLongitude });
    setManualLatitude(nextLatitude.toFixed(6));
    setManualLongitude(nextLongitude.toFixed(6));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      () => {
        window.alert("We could not access your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const applyManualCoordinates = () => {
    const nextLatitude = Number(manualLatitude);
    const nextLongitude = Number(manualLongitude);

    if (Number.isNaN(nextLatitude) || Number.isNaN(nextLongitude)) {
      window.alert("Enter valid latitude and longitude values first.");
      return;
    }

    updateLocation(nextLatitude, nextLongitude);
  };

  return (
    <section className="location-picker">
      <div className="location-picker-header">
        <div>
          <h2>Organization Location</h2>
          <p>Pin your rescue location on the map, use your current position, or enter coordinates manually if needed.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={useCurrentLocation}>
          Use Current Location
        </button>
      </div>

      <div className="location-map-shell">
        <MapContainer center={center} zoom={hasCoordinates ? 13 : 6} scrollWheelZoom className="location-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap center={center} zoom={hasCoordinates ? 13 : 6} />
          <MapClickHandler onPick={updateLocation} />
          {hasCoordinates ? <Marker position={[latitude, longitude]} icon={defaultIcon} /> : null}
        </MapContainer>
      </div>

      <div className="portal-form-grid compact-grid">
        <label>
          Address
          <input
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            placeholder="Enter your office, shelter, or rescue base address"
          />
        </label>
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={manualLatitude}
            onChange={(event) => setManualLatitude(event.target.value)}
            placeholder="Manual latitude"
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={manualLongitude}
            onChange={(event) => setManualLongitude(event.target.value)}
            placeholder="Manual longitude"
          />
        </label>
      </div>

      <div className="portal-actions">
        <button type="button" className="secondary-btn" onClick={applyManualCoordinates}>
          Apply Manual Coordinates
        </button>
        {hasCoordinates ? (
          <p className="meta-line">
            Selected location: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        ) : (
          <p className="meta-line">No map pin selected yet.</p>
        )}
      </div>
    </section>
  );
}

export default LocationPicker;
