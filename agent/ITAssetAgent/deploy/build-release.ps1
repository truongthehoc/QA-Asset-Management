<#
.SYNOPSIS
    Build self-contained .NET 8 Windows Agent (.exe) va goi .msi cho trien khai GPO.
.USAGE
    .\build-release.ps1 -Version "1.2.0"
#>
param(
    [string]$Version = "1.2.0",
    [string]$OutputDir = "$PSScriptRoot\..\release"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay .NET 8 SDK. Vui long cai dat .NET 8 SDK truoc khi build ban C#."
}

$sdks = (& dotnet --list-sdks 2>$null)
if (-not $sdks) {
    throw "May hien tai chua cai .NET SDK (chi co runtime). Vui long cai .NET 8 SDK hoac dung PowerShell Agent tai agent\windows-agent\."
}

$publishDir = Join-Path $OutputDir "win-x64"
if (Test-Path $publishDir) { Remove-Item -Recurse -Force $publishDir }

Write-Host "[1/2] Dang publish ITAssetAgent.exe (self-contained single-file win-x64)..."
dotnet publish "$PSScriptRoot\..\ITAssetAgent.csproj" `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:Version=$Version `
    -o $publishDir

Write-Host "Da tao file: $(Join-Path $publishDir 'ITAssetAgent.exe')"

# Optional WiX MSI build if wix CLI is available
if (Get-Command wix -ErrorAction SilentlyContinue) {
    Write-Host "[2/2] Phat hien WiX Toolset -> Dang dong goi ITAssetAgent-$Version.msi..."
    $msiOut = Join-Path $OutputDir "ITAssetAgent-$Version.msi"
    wix build "$PSScriptRoot\Product.wxs" -d PublishDir="$publishDir" -d Version="$Version" -o $msiOut
    Write-Host "Da dong goi MSI thanh cong: $msiOut"
} else {
    Write-Host "[2/2] Bo qua dong goi MSI (chua cai WiX Toolset). Ban co the cai dat truc tiep bang ITAssetAgent.exe + install-service.ps1."
}
