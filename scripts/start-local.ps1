$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 LTS before starting.' }
if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
  Write-Output 'Created .env. Enter your own Clerk, Neon and OpenAI values, then rerun this script.'
  exit 1
}
if (-not (Test-Path -LiteralPath 'node_modules/.bin/next.cmd')) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
npm run check:env
if ($LASTEXITCODE -ne 0) { throw 'Complete the environment values in .env before starting.' }
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }
npm run dev
