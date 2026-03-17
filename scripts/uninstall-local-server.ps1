# Dock Check Local Server — Clean Uninstaller
# Run: powershell -ExecutionPolicy Bypass -File scripts/uninstall-local-server.ps1

Write-Host "=== Dock Check Local Server — Uninstall ===" -ForegroundColor Cyan

# 1) Kill running process
Write-Host "Stopping running processes..."
taskkill /f /im "Dock Check Local Server.exe" 2>$null
Start-Sleep -Seconds 1

# 2) Run NSIS uninstaller if it exists
$uninstallerPaths = @(
    "$env:LOCALAPPDATA\Programs\Dock Check Local Server\Uninstall Dock Check Local Server.exe",
    "$env:PROGRAMFILES\Dock Check Local Server\Uninstall Dock Check Local Server.exe"
)

foreach ($p in $uninstallerPaths) {
    if (Test-Path $p) {
        Write-Host "Running uninstaller: $p"
        Start-Process -FilePath $p -ArgumentList "/S" -Wait -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        break
    }
}

# 3) Clean residual data directories
$dataPaths = @(
    "$env:APPDATA\Dock Check Local Server",
    "$env:APPDATA\dock-check-local-server",
    "$env:APPDATA\vite_react_shadcn_ts",
    "$env:LOCALAPPDATA\Programs\Dock Check Local Server",
    "$env:LOCALAPPDATA\dock-check-local-server"
)

foreach ($dp in $dataPaths) {
    if (Test-Path $dp) {
        Write-Host "Removing: $dp"
        Remove-Item -Recurse -Force $dp -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Uninstall complete. You can now reinstall." -ForegroundColor Green
