# muxAI control script
#
# Usage:
#   .\muxai.ps1 status
#   .\muxai.ps1 start
#   .\muxai.ps1 stop
#   .\muxai.ps1 restart
#
# Run from anywhere — the script auto-locates itself.
# Status is read-only (safe to spam). Start opens new terminal windows
# for the API and Web so you can see their logs; Ctrl+C in either kills
# that service.

param(
  [Parameter(Position=0)]
  [ValidateSet("status", "start", "stop", "restart")]
  [string]$Command = "status"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $ScriptDir "apps\api"
$WebDir = Join-Path $ScriptDir "apps\web"
$DbDir  = Join-Path $ApiDir ".muxai-db"

$ApiPort = 3001
$WebPort = 3000
$PgPort  = 5433

function Test-Port {
  param([int]$Port)
  try {
    return [bool](Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)
  } catch { return $false }
}

function Get-MuxaiNodeProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "muxai|apps[\\/](api|web)|tsx.*src[\\/]index|next dev"
  }
}

function Get-ClaudeProcesses {
  Get-Process -Name claude -ErrorAction SilentlyContinue
}

function Show-Status {
  Write-Host ""
  Write-Host "muxAI status" -ForegroundColor Cyan
  Write-Host ("-" * 60)

  # Ports
  $apiUp = Test-Port -Port $ApiPort
  $webUp = Test-Port -Port $WebPort
  $pgUp  = Test-Port -Port $PgPort
  Write-Host ("  Web    (port {0,-5}) : {1}" -f $WebPort, $(if ($webUp) { "LISTENING" } else { "closed" })) -ForegroundColor $(if ($webUp) { "Green" } else { "DarkGray" })
  Write-Host ("  API    (port {0,-5}) : {1}" -f $ApiPort, $(if ($apiUp) { "LISTENING" } else { "closed" })) -ForegroundColor $(if ($apiUp) { "Green" } else { "DarkGray" })
  Write-Host ("  PG     (port {0,-5}) : {1}" -f $PgPort, $(if ($pgUp)  { "LISTENING" } else { "closed" })) -ForegroundColor $(if ($pgUp)  { "Green" } else { "DarkGray" })

  # Processes
  $muxaiNode = @(Get-MuxaiNodeProcesses)
  $claude = @(Get-ClaudeProcesses)
  Write-Host ""
  Write-Host ("  muxAI node procs   : {0}" -f $muxaiNode.Count) -ForegroundColor $(if ($muxaiNode.Count -gt 0) { "Green" } else { "DarkGray" })
  foreach ($p in $muxaiNode) {
    $cmd = if ($p.CommandLine) { $p.CommandLine.Substring(0, [Math]::Min(80, $p.CommandLine.Length)) } else { "(unknown)" }
    Write-Host ("    PID {0,-6} : {1}" -f $p.ProcessId, $cmd) -ForegroundColor DarkGray
  }
  Write-Host ("  claude.exe procs   : {0}" -f $claude.Count) -ForegroundColor $(if ($claude.Count -gt 0) { "Yellow" } else { "DarkGray" })

  # DB
  Write-Host ""
  if (Test-Path $DbDir) {
    $size = (Get-ChildItem $DbDir -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Host ("  Database directory : {0}  ({1:N0} bytes)" -f $DbDir, $size) -ForegroundColor Green
  } else {
    Write-Host ("  Database directory : {0}  (MISSING — will be created on first start)" -f $DbDir) -ForegroundColor Yellow
  }

  # Temp files
  $tmp = @(Get-ChildItem -Path $env:TEMP -Filter "muxai-*.tmp" -ErrorAction SilentlyContinue)
  Write-Host ("  Stale temp files   : {0}" -f $tmp.Count) -ForegroundColor $(if ($tmp.Count -gt 0) { "Yellow" } else { "DarkGray" })

  Write-Host ("-" * 60)
  Write-Host ""
}

function Start-Muxai {
  if (Test-Port -Port $ApiPort) {
    Write-Host "API already running on port $ApiPort. Use '.\muxai.ps1 restart' to recycle, or '.\muxai.ps1 stop' first." -ForegroundColor Yellow
    return
  }

  if (-not (Test-Path $ApiDir)) {
    Write-Host "API directory not found: $ApiDir" -ForegroundColor Red
    return
  }
  if (-not (Test-Path $WebDir)) {
    Write-Host "Web directory not found: $WebDir" -ForegroundColor Red
    return
  }

  Write-Host "Starting muxAI API + Web..." -ForegroundColor Cyan
  Write-Host "  Each service opens in its own terminal window. Close a window (or Ctrl+C) to stop that service."
  Write-Host ""

  # Start API window. -WorkingDirectory ensures the embedded PG creates its
  # .muxai-db at the canonical apps/api/.muxai-db path, so the DB persists
  # across restarts regardless of where this script is run from.
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$ApiDir'; `$Host.UI.RawUI.WindowTitle = 'muxAI API'; pnpm tsx src/index.ts"
  ) -WorkingDirectory $ApiDir

  Write-Host "  API window launched. Waiting for port $ApiPort..."
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline -and -not (Test-Port -Port $ApiPort)) {
    Start-Sleep -Milliseconds 500
  }
  if (Test-Port -Port $ApiPort) {
    Write-Host "  API is up on port $ApiPort." -ForegroundColor Green
  } else {
    Write-Host "  API did not come up within 60s — check the API window for errors." -ForegroundColor Red
  }

  # Start Web window
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$WebDir'; `$Host.UI.RawUI.WindowTitle = 'muxAI Web'; pnpm dev"
  ) -WorkingDirectory $WebDir

  Write-Host "  Web window launched. Waiting for port $WebPort..."
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline -and -not (Test-Port -Port $WebPort)) {
    Start-Sleep -Milliseconds 500
  }
  if (Test-Port -Port $WebPort) {
    Write-Host "  Web is up on port $WebPort." -ForegroundColor Green
    Write-Host ""
    Write-Host "  → Open http://localhost:$WebPort" -ForegroundColor Cyan
  } else {
    Write-Host "  Web did not come up within 45s — check the Web window for errors." -ForegroundColor Red
  }
}

function Stop-Muxai {
  Write-Host "Stopping muxAI..." -ForegroundColor Cyan

  $muxaiNode = @(Get-MuxaiNodeProcesses)
  if ($muxaiNode.Count -eq 0) {
    Write-Host "  No muxAI node processes found."
  } else {
    foreach ($p in $muxaiNode) {
      try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        Write-Host ("  Killed muxAI node PID {0}" -f $p.ProcessId) -ForegroundColor Green
      } catch {
        Write-Host ("  Failed to kill PID {0}: {1}" -f $p.ProcessId, $_.Exception.Message) -ForegroundColor Red
      }
    }
  }

  $claude = @(Get-ClaudeProcesses)
  if ($claude.Count -eq 0) {
    Write-Host "  No claude.exe processes found."
  } else {
    foreach ($p in $claude) {
      try {
        Stop-Process -Id $p.Id -Force -ErrorAction Stop
        Write-Host ("  Killed claude.exe PID {0}" -f $p.Id) -ForegroundColor Green
      } catch {
        Write-Host ("  Failed to kill claude PID {0}: {1}" -f $p.Id, $_.Exception.Message) -ForegroundColor Red
      }
    }
  }

  # Sweep stale temp files left by claude-local adapter spawns
  $tmp = @(Get-ChildItem -Path $env:TEMP -Filter "muxai-*.tmp" -ErrorAction SilentlyContinue)
  if ($tmp.Count -gt 0) {
    foreach ($f in $tmp) {
      Remove-Item -Path $f.FullName -Force -ErrorAction SilentlyContinue
    }
    Write-Host ("  Swept {0} stale muxai-*.tmp file(s)" -f $tmp.Count) -ForegroundColor Green
  }

  Start-Sleep -Seconds 2

  # Verify ports closed
  $apiStillUp = Test-Port -Port $ApiPort
  $webStillUp = Test-Port -Port $WebPort
  $pgStillUp  = Test-Port -Port $PgPort
  if ($apiStillUp -or $webStillUp -or $pgStillUp) {
    Write-Host ""
    Write-Host "  Warning: ports still listening after stop:" -ForegroundColor Yellow
    if ($apiStillUp) { Write-Host "    API ($ApiPort) still up — process likely orphaned" -ForegroundColor Yellow }
    if ($webStillUp) { Write-Host "    Web ($WebPort) still up — process likely orphaned" -ForegroundColor Yellow }
    if ($pgStillUp)  { Write-Host "    PG  ($PgPort) still up — embedded-postgres orphaned" -ForegroundColor Yellow }
  } else {
    Write-Host "  All ports closed." -ForegroundColor Green
  }
}

# ── Dispatch ────────────────────────────────────────────────────────
switch ($Command) {
  "status"  { Show-Status }
  "start"   { Start-Muxai;  Show-Status }
  "stop"    { Stop-Muxai;   Show-Status }
  "restart" { Stop-Muxai; Start-Sleep -Seconds 2; Start-Muxai; Show-Status }
}
