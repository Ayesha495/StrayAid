const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");

// In development the phone reaches the Django backend *through* the Expo dev server.
// Requests for backend paths that arrive at Metro (port 8081) are forwarded to Django on
// this computer, so the app only ever needs the address it already loads its code from.
// That means no LAN IP in .env, no Windows Firewall rule for port 8000, and it keeps
// working after the Wi-Fi IP changes or when Expo runs with --tunnel.
// Django can stay on the default `python manage.py runserver` (127.0.0.1:8000).
// Set STRAYAID_BACKEND_URL to forward somewhere else (e.g. a Docker container).

const BACKEND_URL = new URL(process.env.STRAYAID_BACKEND_URL || "http://127.0.0.1:8000");
const BACKEND_PREFIXES = ["/api/", "/auth/", "/media/", "/admin/", "/static/"];

function isBackendPath(url = "") {
  return BACKEND_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function proxyToBackend(req, res) {
  const host = req.headers.host || "";
  const proto =
    req.headers["x-forwarded-proto"] || (/exp\.direct|ngrok/.test(host) ? "https" : "http");

  const upstream = http.request(
    {
      hostname: BACKEND_URL.hostname,
      port: BACKEND_URL.port || 80,
      method: req.method,
      path: req.url,
      // Keep the phone's Host header so Django builds photo URLs that also go through Metro.
      headers: { ...req.headers, "x-forwarded-proto": proto },
    },
    (backendRes) => {
      res.writeHead(backendRes.statusCode || 502, backendRes.headers);
      backendRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    console.warn(`[backend proxy] ${req.method} ${req.url} failed: ${error.message}`);
    if (res.headersSent) return res.end();
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        detail: `The StrayAid backend is not reachable at ${BACKEND_URL.origin}. Start it with: python manage.py runserver`,
      }),
    );
  });

  req.pipe(upstream);
}

const config = getDefaultConfig(__dirname);

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const next = enhanceMiddleware ? enhanceMiddleware(metroMiddleware, server) : metroMiddleware;
  return (req, res, fallthrough) =>
    isBackendPath(req.url) ? proxyToBackend(req, res) : next(req, res, fallthrough);
};

module.exports = config;
