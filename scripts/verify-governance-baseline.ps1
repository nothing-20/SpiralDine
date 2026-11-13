param (
    [switch]$SkipAndroid = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " SpiralDine Engineering Governance — Verification Baseline" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

Write-Host "`n[1/5] TypeScript Check (npx tsc --noEmit)..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }

Write-Host "`n[2/5] Vite Production Build (npm run build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Vite production build failed." }

Write-Host "`n[3/5] Contact Email Workflow Suite..." -ForegroundColor Yellow
node scripts/test-contact-email-workflow.mjs
if ($LASTEXITCODE -ne 0) { throw "Contact email test suite failed." }

Write-Host "`n[4/5] Real Firestore Emulator Security Suite..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/run-emulator-test.ps1 "node scripts/test-phase9-emulator.js"
if ($LASTEXITCODE -ne 0) { throw "Firestore emulator security test suite failed." }

if (-not $SkipAndroid) {
    Write-Host "`n[5/5] Android Gradle Unit Tests (:app, :owner, :customer)..." -ForegroundColor Yellow
    $jdkHome = "$HOME\.jdk-21\jdk-21.0.6+7"
    if (Test-Path "$jdkHome\bin\java.exe") {
        $env:JAVA_HOME = $jdkHome
        $env:PATH = "$jdkHome\bin;$env:PATH"
    }
    Push-Location android
    try {
        .\gradlew.bat testDebugUnitTest --no-daemon
        if ($LASTEXITCODE -ne 0) { throw "Android unit tests failed." }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[5/5] Android Gradle Unit Tests skipped (-SkipAndroid)." -ForegroundColor DarkGray
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " ALL BASELINE CHECKS COMPLETED CLEANLY" -ForegroundColor Green
Write-Host " Note: 'npm run lint' requires adding .eslintrc in Wave 1/Wave 2." -ForegroundColor DarkYellow
Write-Host "================================================================" -ForegroundColor Green

