param (
    [string]$Command = "node scripts/test-phase8-security-regression.js"
)

$jdkHome = "$HOME\.jdk-21\jdk-21.0.6+7"
$jdkBin = "$jdkHome\bin"

if (-not (Test-Path "$jdkBin\java.exe")) {
    Write-Error "JDK 21 not found at $jdkBin"
    exit 1
}

$env:JAVA_HOME = $jdkHome
$env:PATH = "$jdkBin;$env:PATH"

Write-Host "Active Java Version for Emulator:"
& "$jdkBin\java.exe" -version

Write-Host "`nStarting Firestore Emulator with compiled rules..."
firebase.cmd emulators:exec --only firestore $Command
