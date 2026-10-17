$destDir = "$HOME\.jdk-21"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    $zipPath = "$destDir\jdk21.zip"
    Write-Host "Downloading Microsoft OpenJDK 21 portable zip from official Microsoft CDN..."
    Invoke-WebRequest -Uri "https://aka.ms/download-jdk/microsoft-jdk-21.0.6-windows-x64.zip" -OutFile $zipPath
    Write-Host "Extracting portable JDK 21..."
    Expand-Archive -Path $zipPath -DestinationPath $destDir -Force
    Remove-Item -Path $zipPath -Force
    Write-Host "Portable JDK 21 downloaded and extracted successfully."
} else {
    Write-Host "Portable JDK 21 already exists at $destDir"
}

$javaBin = Get-ChildItem -Path $destDir -Filter "java.exe" -Recurse | Select-Object -First 1
if ($javaBin) {
    Write-Host "Found java.exe at: $($javaBin.FullName)"
    & $javaBin.FullName -version
} else {
    Write-Error "java.exe not found in $destDir"
}
