#!/usr/bin/env bash
set -euo pipefail

echo "Running ApniLeap Smoke Test..."
npx tsx scripts/smoke.ts
