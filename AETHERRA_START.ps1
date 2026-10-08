# AETHERRA native Windows launcher - no third-party dependencies.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $root 'AETHERRA_STARTUP.log'
Set-Location -LiteralPath $root
"=== AETHERRA startup ===" | Set-Content -LiteralPath $log -Encoding UTF8
$uri = 'http://127.0.0.1:8765/'
function Healthy {
    try {
        $r = Invoke-RestMethod -Uri ($uri + 'health') -TimeoutSec 2
        return ($r.app -eq 'AETHERRA' -and $r.status -eq 'ok')
    } catch { return $false }
}
if (Healthy) { Write-Host 'Existing AETHERRA server detected.'; if ($env:AETHERRA_NO_BROWSER -ne '1') { Start-Process $uri }; exit 0 }
$candidates = New-Object System.Collections.Generic.List[string]
function Add-Python([string]$path) {
    if ($path -and -not $candidates.Contains($path)) { [void]$candidates.Add($path) }
}
Add-Python (Join-Path $root 'python\python.exe')
Add-Python (Join-Path $root '.venv\Scripts\python.exe')
foreach ($name in @('python','python3','py')) {
    foreach ($cmd in @(Get-Command $name -All -ErrorAction SilentlyContinue)) {
        if ($cmd.Source) { Add-Python $cmd.Source }
    }
}
# Discover regular installations even when the PATH aliases point to deleted copies.
foreach ($base in @((Join-Path $env:LOCALAPPDATA 'Programs\Python'),(Join-Path $env:ProgramFiles 'Python'),(Join-Path $env:ProgramFiles 'Python313'),(Join-Path $env:ProgramFiles 'Python314'))) {
    if (Test-Path -LiteralPath $base) {
        foreach ($exe in @(Get-ChildItem -LiteralPath $base -Filter python.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 20)) {
            Add-Python $exe.FullName
        }
    }
}
$selected = $null
foreach ($exe in $candidates) {
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { continue }
    "Checking candidate: $exe" | Add-Content -LiteralPath $log
    try {
        $args = if ((Split-Path $exe -Leaf) -eq 'py.exe') { @('-3','-c',"print('AETHERRA_PYTHON_OK')") } else { @('-c',"print('AETHERRA_PYTHON_OK')") }
        $result = & $exe @args 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0 -and $result.Trim() -eq 'AETHERRA_PYTHON_OK') {
            $selected = $exe
            break
        }
        "Candidate failed: exit=$LASTEXITCODE output=$($result.Trim())" | Add-Content -LiteralPath $log
    } catch {
        "Candidate failed: $($_.Exception.Message)" | Add-Content -LiteralPath $log
    }
}
if (-not $selected) {
    Write-Host 'ERROR: No working Python interpreter was found.' -ForegroundColor Red
    Write-Host 'Your Windows Python commands may point to a deleted Python314 installation.'
    Write-Host 'Repair/install Python, then run this launcher again. Do not delete your world saves.'
    Write-Host 'See AETHERRA_STARTUP.log for attempted interpreter paths.'
    'ERROR: No interpreter passed the readiness probe.' | Add-Content -LiteralPath $log
    exit 1
}
Write-Host "Starting AETHERRA at $uri"
"Selected interpreter: $selected" | Add-Content -LiteralPath $log
try {
    $args = if ((Split-Path $selected -Leaf) -eq 'py.exe') { @('-3','-u',(Join-Path $root 'server.py')) } else { @('-u',(Join-Path $root 'server.py')) }
    & $selected @args 2>&1 | Tee-Object -FilePath $log -Append | Out-Host
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 1 }
} catch {
    "Server exception: $($_.Exception.Message)" | Tee-Object -FilePath $log -Append | Out-Host
    $exitCode = 1
}
if ($exitCode -ne 0) { Write-Host "Server exited with code $exitCode. Review AETHERRA_STARTUP.log" -ForegroundColor Red }
exit $exitCode
