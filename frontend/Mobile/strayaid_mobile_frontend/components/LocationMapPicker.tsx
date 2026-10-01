import React, { useMemo } from "react";
import { WebView } from "react-native-webview";
import { mapSelectStyles as styles } from "../styles/MapSelectStyles";

type Coordinate = { latitude: number; longitude: number };

type LocationMapPickerProps = {
  location: Coordinate;
  markerPosition: Coordinate | null;
  onPress: (e: { nativeEvent: { coordinate: Coordinate } }) => void;
};

// Uses OpenStreetMap tiles via Leaflet — no API key or billing required.
export default function LocationMapPicker({ location, markerPosition, onPress }: LocationMapPickerProps) {
  const initLat = markerPosition?.latitude ?? location.latitude;
  const initLng = markerPosition?.longitude ?? location.longitude;

  // Generate HTML once on mount; the WebView manages its own marker state after that.
  const html = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${initLat}, ${initLng}], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([${initLat}, ${initLng}], { draggable: true }).addTo(map);

    function send(latlng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        latitude: latlng.lat,
        longitude: latlng.lng
      }));
    }

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      send(e.latlng);
    });

    marker.on('dragend', function() {
      send(marker.getLatLng());
    });
  </script>
</body>
</html>`, [initLat, initLng]);

  return (
    <WebView
      style={styles.map}
      source={{ html }}
      onMessage={(event) => {
        try {
          const coord: Coordinate = JSON.parse(event.nativeEvent.data);
          onPress({ nativeEvent: { coordinate: coord } });
        } catch {}
      }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
    />
  );
}
