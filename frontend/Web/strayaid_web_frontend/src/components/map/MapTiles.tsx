import { TileLayer } from "react-leaflet";
import "./map.css";

/** OpenStreetMap tiles, toned down towards the design's pale green map like on mobile. */
function MapTiles() {
  return (
    <TileLayer
      className="sa-tiles"
      maxZoom={19}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
}

export default MapTiles;
