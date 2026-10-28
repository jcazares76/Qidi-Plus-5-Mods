# Builds the download for non-technical users: dist/QIDI-Plus-5-Dashboard-v<version>.zip
# containing the built dashboard, its launcher and a plain-English README. Used locally and by the
# GitHub release workflow (.github/workflows/release.yml).
#
#   powershell -ExecutionPolicy Bypass -File scripts/package.ps1            # build + package
#   powershell -ExecutionPolicy Bypass -File scripts/package.ps1 -SkipBuild # package the existing build
param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ng = Join-Path $repo 'angular'
$version = (Get-Content (Join-Path $ng 'package.json') -Raw | ConvertFrom-Json).version

# The version shown in the app must match package.json.
$constants = Get-Content (Join-Path $ng 'src\app\core\constants.ts') -Raw
if ($constants -notmatch "APP_VERSION = '$([regex]::Escape($version))'") {
    throw "APP_VERSION in angular/src/app/core/constants.ts doesn't match package.json version $version"
}

if (-not $SkipBuild) {
    Push-Location $ng
    try {
        if (-not (Test-Path 'node_modules')) { npm ci; if ($LASTEXITCODE) { throw 'npm ci failed' } }
        npm run build; if ($LASTEXITCODE) { throw 'Build failed' }
    } finally { Pop-Location }
}

$app = Join-Path $repo 'dashboard\app'
if (-not (Test-Path (Join-Path $app 'index.html'))) { throw 'No build found in dashboard/app – run without -SkipBuild.' }
if (-not (Test-Path (Join-Path $app 'box_slots.cfg'))) { throw 'The build is missing box_slots.cfg.' }

$name = "QIDI-Plus-5-Dashboard-v$version"
$dist = Join-Path $repo 'dist'
$stage = Join-Path $dist $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null

Copy-Item $app (Join-Path $stage 'app') -Recurse
Copy-Item (Join-Path $repo 'dashboard\serve.ps1') $stage
Copy-Item (Join-Path $repo 'dashboard\Open Dashboard.bat') $stage
(Get-Content (Join-Path $repo 'dashboard\README-FIRST.txt') -Raw).Replace('{{VERSION}}', $version) |
    Set-Content (Join-Path $stage 'README-FIRST.txt') -Encoding UTF8

$zip = Join-Path $dist "$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip
Write-Host "Created $zip"
