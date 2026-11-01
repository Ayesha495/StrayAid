#!/usr/bin/env bash
# Runs every StrayAid test suite, then builds the Allure report from their results. A failing
# suite doesn't stop the others: failures belong in the report. Needs each project installed.
set -u

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
results="$here/results"
mkdir -p "$results"
find "$results" -type f -name '*.xml' -delete
failed=0

python_bin="$root/backend/venv/Scripts/python.exe"
[ -x "$python_bin" ] || python_bin="python"

echo "== Backend (Django)"
(cd "$root/backend" && TEST_REPORT_DIR="$results" "$python_bin" manage.py test \
  --settings=config.test_settings --testrunner=xmlrunner.extra.djangotestrunner.XMLTestRunner) || failed=1

# The race tests need real Postgres, so they join the report when its password is available.
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  echo "== Backend races (Postgres)"
  (cd "$root/backend" && TEST_REPORT_DIR="$results" TEST_REPORT_NAME=backend-races.xml "$python_bin" manage.py test core.test_concurrency     --settings=config.test_settings_postgres --noinput --testrunner=xmlrunner.extra.djangotestrunner.XMLTestRunner) || failed=1
fi

echo "== Website (Jest)"
(cd "$root/frontend/Web/strayaid_web_frontend" && JEST_JUNIT_OUTPUT_FILE="$results/website.xml" \
  JEST_JUNIT_SUITE_NAME="Website: {title}" JEST_JUNIT_ANCESTOR_SEPARATOR=" > " \
  npx jest --ci --testTimeout=30000 --reporters=default --reporters=jest-junit) || failed=1

echo "== Mobile app (Jest)"
(cd "$root/frontend/Mobile/strayaid_mobile_frontend" && JEST_JUNIT_OUTPUT_FILE="$results/mobile.xml" \
  JEST_JUNIT_SUITE_NAME="Mobile: {title}" JEST_JUNIT_ANCESTOR_SEPARATOR=" > " \
  npx jest --ci --testTimeout=30000 --reporters=default --reporters=jest-junit) || failed=1

echo "== Browser tests (Playwright)"
(cd "$root/frontend/Web/strayaid_web_frontend" && PLAYWRIGHT_JUNIT_OUTPUT_NAME="$results/browser.xml" \
  npx playwright test --reporter=junit) || failed=1

echo "== Building the report"
rm -rf "$here/report"
(cd "$here" && node tidy-results.mjs && npx allure generate ./results)
exit "$failed"
