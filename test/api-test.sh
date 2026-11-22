#!/usr/bin/env bash
# Runs the API walk-through (test/api-test.js) against a fresh server in demo mode.
# Exits non-zero when a check fails.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node test/api-test.js
