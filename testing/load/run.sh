#!/usr/bin/env bash
# Runs load-test.js with k6 in Docker and saves its charts as load-report.html in this folder.
# The script goes in through stdin and the report comes out with docker cp, because Docker
# Desktop can't mount folders from every Windows drive.
set -u
# Git Bash on Windows would otherwise rewrite the /tmp paths below.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"

name=strayaid-load-test
docker rm -f "$name" >/dev/null 2>&1
docker run --name "$name" -i \
  -e K6_WEB_DASHBOARD=true \
  -e K6_WEB_DASHBOARD_EXPORT=/tmp/load-report.html \
  -e K6_WEB_DASHBOARD_PERIOD=10s \
  grafana/k6:latest run - < load-test.js
code=$?
docker cp "$name:/tmp/load-report.html" ./load-report.html
docker rm -f "$name" >/dev/null 2>&1
exit "$code"
