param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$LogDir = Join-Path $BackendDir "logs"
$BackendLog = Join-Path $LogDir "dev-backend.log"
$BackendErrorLog = Join-Path $LogDir "dev-backend.err.log"

$startedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

function Test-HttpOk {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url $Url) {
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "Timed out waiting for $Url"
}

function Stop-StartedProcesses {
    foreach ($process in $startedProcesses) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

    if (-not (Test-Path $BackendPython)) {
        $BackendPython = "python"
    }

    $backendUrl = "http://${HostAddress}:${BackendPort}/api/health"
    $frontendUrl = "http://${HostAddress}:${FrontendPort}/"

    if (Test-HttpOk -Url $backendUrl) {
        Write-Host "Backend already running at $backendUrl"
    }
    else {
        Write-Host "Starting backend at $backendUrl"
        $backendProcess = Start-Process `
            -FilePath $BackendPython `
            -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", $HostAddress, "--port", "$BackendPort") `
            -WorkingDirectory $BackendDir `
            -RedirectStandardOutput $BackendLog `
            -RedirectStandardError $BackendErrorLog `
            -WindowStyle Hidden `
            -PassThru
        $startedProcesses.Add($backendProcess)
        Wait-ForHttp -Url $backendUrl -TimeoutSeconds 30
    }

    if (Test-HttpOk -Url $frontendUrl) {
        Write-Host "Frontend already running at $frontendUrl"
        Write-Host "Backend:  $backendUrl"
        Write-Host "Frontend: $frontendUrl"
        Write-Host "Press Ctrl+C to stop processes started by this script."
        while ($true) {
            Start-Sleep -Seconds 5
        }
    }

    Write-Host "Starting frontend at $frontendUrl"
    Write-Host "Backend:  $backendUrl"
    Write-Host "Frontend: $frontendUrl"
    Write-Host "Backend logs: $BackendLog"
    Write-Host ""

    $npmCommand = "npm"
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        $npmCommand = "npm.cmd"
    }

    Push-Location $FrontendDir
    & $npmCommand run dev -- --host $HostAddress --port $FrontendPort
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    Stop-StartedProcesses
}
