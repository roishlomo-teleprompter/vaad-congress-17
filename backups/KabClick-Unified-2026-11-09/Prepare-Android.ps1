$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm run sync:android
if ($LASTEXITCODE -ne 0) { throw 'Android sync failed' }
Write-Host 'Source ready. Open Android Studio with: npm run open:android'
