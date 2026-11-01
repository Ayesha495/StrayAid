# Observability and test reports

Where to see how StrayAid is running and how its testing looks. All of it is free.

| What | Where | Shows |
|------|-------|-------|
| Website visitors | Vercel → project → **Analytics** | Visitors, page views, top pages, countries, devices |
| Website speed | Vercel → project → **Speed Insights** | Real Experience Score, LCP, INP, CLS |
| Website traffic | Vercel → project → **Observability** | Edge requests, bandwidth, errors |
| Backend | Render → `strayaid-api` → **Metrics** | CPU, memory, HTTP requests, bandwidth |
| Backend logs | Render → `strayaid-api` → **Logs** | Requests, errors and the audit trail |
| Database | Neon → project → **Monitoring** | Compute, RAM, connections, rows, database size |
| Tests | `testing/report` (below) | Pass rate, suites, durations, test-by-test results |
| Load | `testing/load/load-report.html` | Request rate, response times, failures over time |

Vercel's **Analytics** and **Speed Insights** collect nothing until they're switched on in each
tab with **Enable**. Render's free server sleeps after 15 idle minutes, so its graphs have gaps,
and Neon suspends the database when idle, which also shows as gaps. Both are normal.

## Test report (Allure)

```bash
cd testing
npm ci
npm run report    # runs every suite, then builds the report
npm run open      # opens it in the browser
```

It needs the backend, website and mobile projects installed. Set `POSTGRES_PASSWORD` first to
include the race tests. Every push also builds the report in GitHub Actions: open the run and
download the `test-report` artifact.

## Load test (k6)

```bash
cd testing
npm run load      # needs Docker running; takes about six minutes
```

This sends real traffic to the live site, staying under its rate limits (about one request a
second). Open `testing/load/load-report.html` for the charts. Run it before taking screenshots
of the Render and Neon graphs, and don't raise the numbers much: the free server is small, and a
heavy run would measure the rate limits, not the app.
