// The Leaflet page behind the rescue map (Stitch 12). OpenStreetMap tiles, free and keyless,
// toned down with a CSS filter towards the design's pale green map. The same page runs in a
// WebView on the phone and an iframe on the web build.
//
// Messages in (window.receive):  {type:"ping"} {type:"cases", cases, selectedId} {type:"select", id}
//                                {type:"center", lat, lng, zoom?} {type:"user", lat, lng}
//                                {type:"fit", points:[{lat,lng}], top?, bottom?}
// Messages out (send):           {type:"ready"} {type:"select", id} {type:"moved", lat, lng}

export type MapCase = { id: number; lat: number; lng: number; severity: "low" | "medium" | "high" | "critical" };

const PAW =
  "M4.5 11.5c1.38 0 2.5-1.12 2.5-2.5S5.88 6.5 4.5 6.5 2 7.62 2 9s1.12 2.5 2.5 2.5zm4.5-4c1.38 0 2.5-1.12 2.5-2.5S10.38 2.5 9 2.5 6.5 3.62 6.5 5 7.62 7.5 9 7.5zm6 0c1.38 0 2.5-1.12 2.5-2.5S16.38 2.5 15 2.5 12.5 3.62 12.5 5s1.12 2.5 2.5 2.5zm4.5 4c1.38 0 2.5-1.12 2.5-2.5S20.88 6.5 19.5 6.5 17 7.62 17 9s1.12 2.5 2.5 2.5zm-2.33 2.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z";

export function rescueMapHtml(center: { lat: number; lng: number }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #EBF1E9; }
  .tiles { filter: saturate(0.45) sepia(0.12) hue-rotate(55deg) brightness(1.06) contrast(0.9); }
  .leaflet-control-attribution { font: 9px sans-serif; background: rgba(255,255,255,0.7) !important; }
  .leaflet-div-icon { background: none; border: none; }
  .pin { display: flex; flex-direction: column; align-items: center; transition: transform .15s; }
  .pin .head { width: var(--s); height: var(--s); border-radius: 50%; background: var(--c);
    border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.25); display: flex; align-items: center; justify-content: center; }
  .pin .dot { width: 38%; height: 38%; border-radius: 50%; background: #fff; }
  .pin .tail { width: 6px; height: 7px; margin-top: -2px; background: var(--c); border-radius: 0 0 2px 2px; }
  .sel { position: relative; display: flex; flex-direction: column; align-items: center; }
  .sel .pulse { position: absolute; top: -10px; width: 64px; height: 64px; border-radius: 50%;
    background: rgba(30,107,86,.3); animation: pulse 1.8s ease-out infinite; }
  .sel .bubble { position: relative; width: 44px; height: 44px; border-radius: 50%; background: #1E6B56;
    border: 4px solid #fff; box-shadow: 0 4px 12px rgba(30,107,86,.35); display: flex; align-items: center; justify-content: center; }
  .sel .needle { width: 10px; height: 10px; margin-top: -7px; background: #1E6B56; transform: rotate(45deg);
    border-right: 2px solid #fff; border-bottom: 2px solid #fff; }
  .sel .ground { width: 20px; height: 6px; margin-top: 3px; border-radius: 50%; background: rgba(0,0,0,.25); filter: blur(1px); }
  .me { width: 16px; height: 16px; border-radius: 50%; background: #4A90E2; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(74,144,226,.2); }
  @keyframes pulse { 0% { transform: scale(.7); opacity: .9 } 100% { transform: scale(1.35); opacity: 0 } }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var COLORS = { critical: "#E5534B", high: "#F47C6C", medium: "#F4B360", low: "#35A982" };
  var map = L.map("map", { zoomControl: false }).setView([${center.lat}, ${center.lng}], 14);
  map.attributionControl.setPrefix(false);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, className: "tiles", attribution: "\\u00a9 OpenStreetMap contributors"
  }).addTo(map);

  var markers = {}, cases = [], selectedId = null, me = null;

  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(JSON.stringify({ fromRescueMap: true, message: message }), "*");
  }

  function icon(item) {
    if (item.id === selectedId) {
      return L.divIcon({
        className: "", iconSize: [64, 70], iconAnchor: [32, 60],
        html: '<div class="sel"><div class="pulse"></div><div class="bubble">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="${PAW}"/></svg></div>' +
          '<div class="needle"></div><div class="ground"></div></div>'
      });
    }
    var big = item.severity === "high" || item.severity === "critical";
    var size = big ? 28 : 24;
    return L.divIcon({
      className: "", iconSize: [size, size + 7], iconAnchor: [size / 2, size + 7],
      html: '<div class="pin" style="--c:' + COLORS[item.severity] + ';--s:' + size + 'px">' +
        '<div class="head"><div class="dot"></div></div><div class="tail"></div></div>'
    });
  }

  function draw() {
    Object.keys(markers).forEach(function (id) { map.removeLayer(markers[id]); });
    markers = {};
    cases.forEach(function (item) {
      var marker = L.marker([item.lat, item.lng], { icon: icon(item), zIndexOffset: item.id === selectedId ? 1000 : 0 });
      marker.on("click", function () { send({ type: "select", id: item.id }); });
      marker.addTo(map);
      markers[item.id] = marker;
    });
  }

  window.receive = function (message) {
    // The app can ask again in case it missed the first "ready" (iframe timing on the web).
    if (message.type === "ping") send({ type: "ready" });
    if (message.type === "cases") { cases = message.cases; selectedId = message.selectedId; draw(); }
    if (message.type === "select") {
      selectedId = message.id; draw();
      var item = cases.find(function (c) { return c.id === message.id; });
      if (item && message.pan) map.panTo([item.lat, item.lng]);
    }
    if (message.type === "center") map.setView([message.lat, message.lng], message.zoom || map.getZoom());
    // Frame several points, leaving room for the search bar (top) and case card (bottom).
    if (message.type === "fit" && message.points.length) {
      map.fitBounds(message.points.map(function (p) { return [p.lat, p.lng]; }), {
        paddingTopLeft: [40, message.top || 40], paddingBottomRight: [40, message.bottom || 40], maxZoom: 15
      });
    }
    if (message.type === "user") {
      if (me) map.removeLayer(me);
      me = L.marker([message.lat, message.lng], {
        icon: L.divIcon({ className: "", iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="me"></div>' }),
        interactive: false
      }).addTo(map);
    }
  };
  window.addEventListener("message", function (event) {
    try {
      var data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data && data.toRescueMap) window.receive(data.message);
    } catch (error) {}
  });
  map.on("moveend", function () { var c = map.getCenter(); send({ type: "moved", lat: c.lat, lng: c.lng }); });
  send({ type: "ready" });
</script>
</body>
</html>`;
}
