#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
xcodebuild -version
npm ci
npm test
npm run sync:ios
npm run open:ios
