// Readable names for the report. Each suite goes under the part of StrayAid it tests, and the
// timestamp the Django runner adds to suite names is dropped. Giving the Postgres race tests their
// own names matters most: otherwise Allure treats them as retries of the same tests, which are
// skipped on SQLite, and reports them as skipped even though they passed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RESULTS = new URL("./results/", import.meta.url);

const GROUPS = {
  "backend.xml": "Backend",
  "backend-races.xml": "Backend on Postgres",
  "browser.xml": "Browser",
};

const SKIPPED_RACE_COPY = /<testcase\b[^>]*classname="[^"]*test_concurrency[^"]*"[^>]*(?:\/>|>[\s\S]*?<\/testcase>)/g;

// Removes any group already there, so running this twice changes nothing.
const named = (group, name) => `${group}: ${name.replace(/^(?:[A-Za-z ]+: )+/, "").replace(/-\d{14}$/, "")}`;

const hasRaceResults = existsSync(new URL("backend-races.xml", RESULTS));

for (const [file, group] of Object.entries(GROUPS)) {
  const path = new URL(file, RESULTS);
  if (!existsSync(path)) continue;
  let xml = readFileSync(path, "utf8");
  // Their Postgres results are in the report, so the SQLite copies would count them twice.
  if (file === "backend.xml" && hasRaceResults) xml = xml.replace(SKIPPED_RACE_COPY, "");
  xml = xml
    .replace(/(<testsuite\b[^>]*?\sname=")([^"]*)"/g, (_match, start, name) => `${start}${named(group, name)}"`)
    .replace(/(<testcase\b[^>]*?\sclassname=")([^"]*)"/g, (_match, start, name) => `${start}${named(group, name)}"`);
  writeFileSync(path, xml);
}
