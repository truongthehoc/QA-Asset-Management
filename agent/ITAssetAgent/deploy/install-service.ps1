# Install IT Asset Management Windows Agent as a Windows Service
# Run as Administrator: .\install-service.ps1 -BackendUrl "https://itam.corp.local:3001" -EnrollmentToken "ENROLL-ITAM-2026-INTERNAL"
param(
    [Parameter(Mandatory=$true)][string]$BackendUrl,
    [Parameter(Mandatory=$true)][string]$EnrollmentToken,
    [string]$InstallDir = "C:\Program Files\ITAssetAgent"
)

$ErrorActionPreference = "Stop"
Write-Host "Publishing .NET 8 Windows Agent..."
dotnet publish "$PSScriptRoot\..\ITAssetAgent.csproj" -c Release -r win-x64 --self-contained true -o $InstallDir

$cfgPath = Join-Path $InstallDir "appsettings.json"
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
$cfg.Agent.BackendBaseUrl = $BackendUrl
$cfg.Agent.EnrollmentToken = $EnrollmentToken
$cfg | ConvertTo-Json -Depth 5 | Set-Content $cfgPath -Encoding UTF8

$svcName = "ITAssetManagementAgent"
if (Get-Service -Name $svcName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $svcName -Force
    sc.exe delete $svcName | Out-Null
    Start-Sleep -Seconds 2
}

$exePath = Join-Path $InstallDir "ITAssetAgent.exe"
New-Service -Name $svcName -BinaryPathName "`"$exePath`"" -DisplayName "IT Asset Management Windows Agent" -StartupType Automatic -Description "Thu thap cau hinh phan cung, he dieu hanh va phan mem phuc vu quan ly tai san CNTT noi bo."
Start-Service -Name $svcName
Write-Host "Service '$svcName' installed and running!"
