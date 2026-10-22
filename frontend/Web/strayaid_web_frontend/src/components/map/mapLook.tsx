import { TileLayer } from "react-leaflet";
import L from "leaflet";
import "./map.css";

// The mobile app's map look (frontend/Mobile/.../components/map/rescueMapHtml.ts), shared by
// every web map: tinted OpenStreetMap tiles, severity pins, a green brand pin for one place
// and the green service-area circle. Keep the two in step.

export const MAP_GREEN = "#1E6B56";

const SEVERITY_COLORS: Record<string, string> = { critical: "#E5534B", high: "#F47C6C", medium: "#F4B360", low: "#35A982" };

const PAW =
  "M4.5 11.5c1.38 0 2.5-1.12 2.5-2.5S5.88 6.5 4.5 6.5 2 7.62 2 9s1.12 2.5 2.5 2.5zm4.5-4c1.38 0 2.5-1.12 2.5-2.5S10.38 2.5 9 2.5 6.5 3.62 6.5 5 7.62 7.5 9 7.5zm6 0c1.38 0 2.5-1.12 2.5-2.5S16.38 2.5 15 2.5 12.5 3.62 12.5 5s1.12 2.5 2.5 2.5zm4.5 4c1.38 0 2.5-1.12 2.5-2.5S20.88 6.5 19.5 6.5 17 7.62 17 9s1.12 2.5 2.5 2.5zm-2.33 2.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z";

/** OpenStreetMap tiles, toned down towards the design's pale green map like on mobile. */
export function MapTiles() {
  return (
    <TileLayer
      className="sa-tiles"
      maxZoom={19}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
}

/** A rescue case, coloured by severity. Unknown severities show as medium. */
export function casePin(severity?: string | null) {
  const color = SEVERITY_COLORS[severity ?? ""] ?? SEVERITY_COLORS.medium;
  const size = severity === "high" || severity === "critical" ? 28 : 24;
  return L.divIcon({
    className: "",
    iconSize: [size, size + 7],
    iconAnchor: [size / 2, size + 7],
    popupAnchor: [0, -size],
    html: `<div class="sa-pin" style="--c:${color};--s:${size}px"><div class="sa-pin-head"><div class="sa-pin-dot"></div></div><div class="sa-pin-tail"></div></div>`,
  });
}

/** One place (a case location, a picked spot): the green bubble with a paw, as on mobile. */
export const placePin = L.divIcon({
  className: "",
  iconSize: [64, 70],
  iconAnchor: [32, 60],
  popupAnchor: [0, -52],
  html:
    '<div class="sa-place"><div class="sa-place-pulse"></div><div class="sa-place-bubble">' +
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="${PAW}"/></svg></div>` +
    '<div class="sa-place-needle"></div><div class="sa-place-ground"></div></div>',
});

/** An organization's base: a solid green dot. Grey when it isn't taking cases. */
export const basePathOptions = (active = true) => ({
  color: "#fff",
  weight: 2,
  fillColor: active ? MAP_GREEN : "#94A3B8",
  fillOpacity: 1,
});

/** The service-area circle around an organization's base. */
export const areaPathOptions = { color: MAP_GREEN, weight: 1.5, fillColor: MAP_GREEN, fillOpacity: 0.08 };
