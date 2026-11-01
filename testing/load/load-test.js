// A gentle traffic run against the live site: enough to fill the Render, Neon and Vercel graphs
// and show how the API behaves under steady use. It stays under the API's rate limits on purpose,
// because the free server is small and this is a measurement, not an attack.
//
//   npm run load       (see testing/package.json)

import { check, sleep } from "k6";
import http from "k6/http";

const API = __ENV.API_URL || "https://strayaid-api.onrender.com";
const WEBSITE = __ENV.WEBSITE_URL || "https://stray-aid.vercel.app";

// Grouped, so each endpoint gets its own line in the report instead of one per search word.
const PLACES = ["G-11", "F-7", "Saddar", "E-11", "I-8", "dog", "cat"];

export const options = {
  stages: [
    { duration: "1m", target: 2 },
    { duration: "4m", target: 4 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:api}": ["p(95)<3000"],
  },
};

function get(url, name, kind = "api") {
  const reply = http.get(url, { tags: { name, kind } });
  check(reply, { [`${name} answered`]: (response) => response.status === 200 });
}

export function setup() {
  // The free server sleeps when idle; wake it so the first minute isn't measuring that.
  http.get(`${API}/api/health/`, { timeout: "90s" });
}

export default function () {
  get(`${API}/api/cases/map/`, "rescue map");
  sleep(2);
  get(`${API}/api/animals/public/`, "public animals");
  sleep(2);
  const place = PLACES[Math.floor(Math.random() * PLACES.length)];
  get(`${API}/api/cases/search/?q=${encodeURIComponent(place)}`, "case search");
  sleep(3);
  get(`${API}/api/posts/public-feed/`, "community feed");
  sleep(2);
  get(`${API}/api/cases/stats/`, "community stats");
  sleep(2);
  get(`${WEBSITE}/`, "website home", "website");
  sleep(3);
}
