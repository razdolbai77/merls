$ErrorActionPreference = "Stop"

Write-Host "Building package..." -ForegroundColor Cyan
npm run build

Write-Host "Publishing to npm..." -ForegroundColor Cyan
npm publish --access=public

Write-Host "Publish successful!" -ForegroundColor Green
