<#
.SYNOPSIS
    IT Asset Management - Windows Endpoint Agent (Zero-Dependency PowerShell Edition)
.DESCRIPTION
    Thu thap cau hinh phan cung, he dieu hanh, trang thai kich hoat Windows va danh sach phan mem,
    gui ve IT Asset Management Server (Enroll -> Initial Inventory -> Heartbeat & Periodic Snapshot).
.PARAMETER Mode
    Once   : Chay 1 lan (Enroll neu chua dang ky -> Gui Snapshot -> Gui Heartbeat)
    Daemon : Chay ngam lien tuc theo chu ky tu Server Config (mac dinh)
.PARAMETER ConfigPath
    Duong dan file config.json (mac dinh: C:\ProgramData\ITAssetAgent\config.json)
#>
param(
    [ValidateSet("Daemon", "Once")]
    [string]$Mode = "Daemon",
    [string]$ConfigPath = "C:\ProgramData\ITAssetAgent\config.json"
)

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $ConfigPath)) {
    $fallbackCfg = Join-Path $ScriptDir "config.json"
    if (Test-Path $fallbackCfg) { $ConfigPath = $fallbackCfg }
}

$DataDir = Split-Path -Parent $ConfigPath
if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
$LogDir = Join-Path $DataDir "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$StatePath = Join-Path $DataDir "state.json"
$StatusPath = Join-Path $DataDir "status.json"
$LogFile = Join-Path $LogDir "agent.log"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] [$Level] $Message"
    try {
        if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 5MB) {
            Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
        }
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    } catch {}
    if ($Mode -eq "Once") { Write-Host $line }
}

function Load-Config {
    if (-not (Test-Path $ConfigPath)) {
        throw "Khong tim thay file cau hinh: $ConfigPath"
    }
    return (Get-Content -Path $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Load-State {
    if (Test-Path $StatePath) {
        try {
            return (Get-Content -Path $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json)
        } catch {}
    }
    return $null
}

function Save-State {
    param([string]$AgentUid, [string]$AgentToken)
    $obj = [ordered]@{
        agentUid   = $AgentUid
        agentToken = $AgentToken
        enrolledAt = (Get-Date).ToString("o")
    }
    $obj | ConvertTo-Json -Depth 4 | Set-Content -Path $StatePath -Encoding UTF8
}

function Save-Status {
    param(
        [string]$StateText,
        [string]$BackendUrl,
        [string]$AgentUid = "",
        [string]$LastHeartbeatAt = "",
        [string]$LastSnapshotAt = "",
        [string]$LastError = ""
    )
    $existing = $null
    if (Test-Path $StatusPath) {
        try { $existing = Get-Content $StatusPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    }
    $obj = [ordered]@{
        status          = $StateText
        hostname        = $env:COMPUTERNAME
        backendUrl      = $BackendUrl
        agentUid        = if ($AgentUid) { $AgentUid } elseif ($existing) { $existing.agentUid } else { "" }
        lastHeartbeatAt = if ($LastHeartbeatAt) { $LastHeartbeatAt } elseif ($existing) { $existing.lastHeartbeatAt } else { "" }
        lastSnapshotAt  = if ($LastSnapshotAt) { $LastSnapshotAt } elseif ($existing) { $existing.lastSnapshotAt } else { "" }
        lastError       = $LastError
        updatedAt       = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
    try {
        $obj | ConvertTo-Json -Depth 4 | Set-Content -Path $StatusPath -Encoding UTF8
    } catch {}
}

function Enable-SelfSignedCertIfAllowed {
    param([bool]$Allow)
    if (-not $Allow) { return }
    try {
        add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class ITAMTrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) { return true; }
}
"@ -ErrorAction SilentlyContinue
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object ITAMTrustAllCertsPolicy
    } catch {}
}

function Invoke-ItamApi {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $params = @{
        Method      = $Method
        Uri         = $Url
        Headers     = $Headers
        ContentType = "application/json; charset=utf-8"
        TimeoutSec  = 30
        UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 8 -Compress
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    return Invoke-RestMethod @params
}

function Collect-HardwareInventory {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
    $csp = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue
    $bb = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction SilentlyContinue
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $procs = @(Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue)
    $mems = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue)
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue)
    $nics = @(Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter "IPEnabled=TRUE" -ErrorAction SilentlyContinue)
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue)

    $totalRamGb = if ($cs -and $cs.TotalPhysicalMemory) { [math]::Round($cs.TotalPhysicalMemory / 1GB, 1) } else { 0 }
    $totalDiskGb = 0
    $freeDiskGb = 0
    foreach ($ld in $logical) {
        if ($ld.Size) { $totalDiskGb += [math]::Round($ld.Size / 1GB, 0) }
        if ($ld.FreeSpace) { $freeDiskGb += [math]::Round($ld.FreeSpace / 1GB, 0) }
    }

    $procList = @()
    foreach ($p in $procs) {
        $procList += [ordered]@{
            name              = ($p.Name -as [string]).Trim()
            manufacturer      = $p.Manufacturer
            cores             = [int]($p.NumberOfCores)
            logicalProcessors = [int]($p.NumberOfLogicalProcessors)
            maxClockMhz       = [int]($p.MaxClockSpeed)
        }
    }

    $memTypeMap = @{ 20 = "DDR"; 21 = "DDR2"; 24 = "DDR3"; 26 = "DDR4"; 34 = "DDR5" }
    $memList = @()
    foreach ($m in $mems) {
        $mType = if ($memTypeMap.ContainsKey([int]$m.SMBIOSMemoryType)) { $memTypeMap[[int]$m.SMBIOSMemoryType] } else { "RAM" }
        $memList += [ordered]@{
            slot         = $m.DeviceLocator
            capacityGb   = [math]::Round($m.Capacity / 1GB, 1)
            memoryType   = $mType
            speedMhz     = [int]($m.Speed)
            manufacturer = ($m.Manufacturer -as [string]).Trim()
            serialNumber = ($m.SerialNumber -as [string]).Trim()
        }
    }

    $diskList = @()
    $idx = 0
    foreach ($d in $disks) {
        $sizeGb = if ($d.Size) { [math]::Round($d.Size / 1GB, 0) } else { 0 }
        $diskList += [ordered]@{
            model        = ($d.Model -as [string]).Trim()
            serialNumber = ($d.SerialNumber -as [string]).Trim()
            mediaType    = if ($d.InterfaceType -match "NVMe" -or $d.Model -match "NVMe") { "NVMe SSD" } elseif ($d.MediaType) { $d.MediaType } else { "Fixed Disk" }
            sizeGb       = $sizeGb
            freeGb       = if ($idx -eq 0 -and $freeDiskGb -gt 0) { $freeDiskGb } else { $null }
        }
        $idx++
    }
    if ($totalDiskGb -eq 0 -and $diskList.Count -gt 0) {
        $totalDiskGb = ($diskList | Measure-Object -Property sizeGb -Sum).Sum
    }

    $nicList = @()
    foreach ($n in $nics) {
        $ipv4 = @($n.IPAddress | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' }) | Select-Object -First 1
        $desc = ($n.Description -as [string]).Trim()
        $isVirt = $desc -match "Virtual|Hyper-V|VMware|TAP|VPN|Loopback|WSL|Bluetooth"
        $nicList += [ordered]@{
            name       = $desc
            macAddress = if ($n.MACAddress) { $n.MACAddress.ToUpper() } else { "" }
            ipAddress  = if ($ipv4) { $ipv4 } else { "" }
            speedMbps  = 1000
            status     = "UP"
            isVirtual  = [bool]$isVirt
        }
    }

    $gpuList = @()
    foreach ($g in $gpus) {
        $vramMb = if ($g.AdapterRAM -and $g.AdapterRAM -gt 0) { [math]::Round($g.AdapterRAM / 1MB, 0) } else { 0 }
        $gpuList += [ordered]@{
            name   = ($g.Name -as [string]).Trim()
            vramMb = $vramMb
        }
    }

    # Windows License status (SRS 4.6: only 5-char partial key, NEVER full product key)
    $actStatus = "UNKNOWN"
    $licChannel = ""
    $partialKey = ""
    $licDesc = ""
    try {
        $slp = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($slp) {
            $actStatus = if ($slp.LicenseStatus -eq 1) { "ACTIVATED" } else { "NOT_ACTIVATED" }
            $partialKey = $slp.PartialProductKey
            $licDesc = $slp.Description
            if ($licDesc -match "OEM") { $licChannel = "OEM" }
            elseif ($licDesc -match "VOLUME|KMS|MAK") { $licChannel = "VOLUME" }
            elseif ($licDesc -match "RETAIL") { $licChannel = "RETAIL" }
        }
    } catch {}

    $displayVer = ""
    try {
        $cv = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -ErrorAction SilentlyContinue
        $displayVer = if ($cv.DisplayVersion) { $cv.DisplayVersion } else { $cv.ReleaseId }
    } catch {}

    # Installed software from 64-bit & 32-bit Uninstall Registry
    $swMap = @{}
    $regPaths = @(
        @{ Path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"; Arch = "x64" },
        @{ Path = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"; Arch = "x86" }
    )
    foreach ($rp in $regPaths) {
        $entries = Get-ItemProperty -Path $rp.Path -ErrorAction SilentlyContinue
        foreach ($e in $entries) {
            if (-not $e.DisplayName) { continue }
            $name = ($e.DisplayName -as [string]).Trim()
            if (-not $name -or $e.SystemComponent -eq 1) { continue }
            $key = "$name|$($e.DisplayVersion)"
            if (-not $swMap.ContainsKey($key)) {
                $swMap[$key] = [ordered]@{
                    displayName    = $name
                    publisher      = if ($e.Publisher) { ($e.Publisher -as [string]).Trim() } else { $null }
                    displayVersion = if ($e.DisplayVersion) { ($e.DisplayVersion -as [string]).Trim() } else { $null }
                    architecture   = $rp.Arch
                    installDate    = if ($e.InstallDate) { ($e.InstallDate -as [string]).Trim() } else { $null }
                }
            }
        }
    }
    $softwareList = @($swMap.Values | Select-Object -First 300)

    $biosDate = ""
    if ($bios -and $bios.ReleaseDate) {
        try { $biosDate = ([datetime]$bios.ReleaseDate).ToString("yyyy-MM-dd") } catch {}
    }

    return [ordered]@{
        computerName    = $env:COMPUTERNAME
        hostname        = $env:COMPUTERNAME
        smbiosUuid      = if ($csp -and $csp.UUID) { $csp.UUID.ToUpper() } else { $null }
        serialNumber    = if ($bios -and $bios.SerialNumber) { $bios.SerialNumber.Trim() } else { $null }
        manufacturer    = if ($cs -and $cs.Manufacturer) { $cs.Manufacturer.Trim() } else { $null }
        model           = if ($cs -and $cs.Model) { $cs.Model.Trim() } else { $null }
        mainboardMfg    = if ($bb -and $bb.Manufacturer) { $bb.Manufacturer.Trim() } else { $null }
        mainboardProduct = if ($bb -and $bb.Product) { $bb.Product.Trim() } else { $null }
        mainboardSerial = if ($bb -and $bb.SerialNumber) { $bb.SerialNumber.Trim() } else { $null }
        biosMfg         = if ($bios -and $bios.Manufacturer) { $bios.Manufacturer.Trim() } else { $null }
        biosVersion     = if ($bios -and $bios.SMBIOSBIOSVersion) { $bios.SMBIOSBIOSVersion.Trim() } else { $null }
        biosReleaseDate = $biosDate
        totalRamGb      = $totalRamGb
        totalDiskGb     = $totalDiskGb
        processors      = $procList
        memoryModules   = $memList
        disks           = $diskList
        networkAdapters = $nicList
        graphics        = $gpuList
        operatingSystem = [ordered]@{
            productName        = if ($os -and $os.Caption) { $os.Caption.Trim() } else { "Windows" }
            edition            = if ($os -and $os.OperatingSystemSKU) { "SKU-$($os.OperatingSystemSKU)" } else { "Windows" }
            version            = $displayVer
            buildNumber        = if ($os) { $os.BuildNumber } else { "" }
            architecture       = if ($os) { $os.OSArchitecture } else { "64-bit" }
            activationStatus   = $actStatus
            licenseChannel     = $licChannel
            partialProductKey  = $partialKey
            licenseDescription = $licDesc
        }
        software        = $softwareList
    }
}

function Get-PrimaryNic {
    param($Inventory)
    $phys = @($Inventory.networkAdapters | Where-Object { -not $_.isVirtual -and $_.ipAddress }) | Select-Object -First 1
    if ($phys) { return $phys }
    return ($Inventory.networkAdapters | Select-Object -First 1)
}

function Get-CurrentUsage {
    $cpuLoad = 0
    $ramPct = 0
    try {
        $p = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average
        if ($p -and $null -ne $p.Average) { $cpuLoad = [math]::Round($p.Average, 1) }
    } catch {}
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($os -and $os.TotalVisibleMemorySize -gt 0) {
            $used = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
            $ramPct = [math]::Round(($used / $os.TotalVisibleMemorySize) * 100, 1)
        }
    } catch {}
    return @{ cpu = $cpuLoad; ram = $ramPct }
}

function Ensure-Enrolled {
    param($Config, $Inventory)
    $state = Load-State
    if ($state -and $state.agentUid -and $state.agentToken) {
        return $state
    }
    if (-not $Config.EnrollmentToken) {
        throw "Thieu EnrollmentToken trong config.json."
    }
    $baseUrl = $Config.BackendBaseUrl.TrimEnd('/')
    $nic = Get-PrimaryNic -Inventory $Inventory
    $payload = [ordered]@{
        enrollmentToken = $Config.EnrollmentToken
        hostname        = $Inventory.hostname
        computerName    = $Inventory.computerName
        smbiosUuid      = $Inventory.smbiosUuid
        biosSerial      = $Inventory.serialNumber
        primaryMac      = if ($nic) { $nic.macAddress } else { $null }
        ipAddress       = if ($nic) { $nic.ipAddress } else { $null }
        manufacturer    = $Inventory.manufacturer
        model           = $Inventory.model
        osSummary       = "$($Inventory.operatingSystem.productName) $($Inventory.operatingSystem.version)".Trim()
        agentVersion    = if ($Config.AgentVersion) { $Config.AgentVersion } else { "1.3.0" }
    }
    Write-AgentLog "Dang dang ky (Enroll) may $($Inventory.hostname) toi $baseUrl..."
    $res = Invoke-ItamApi -Method "POST" -Url "$baseUrl/api/v1/agent/enroll" -Body $payload
    Save-State -AgentUid $res.agentUid -AgentToken $res.agentToken
    Write-AgentLog "Enroll thanh cong! AgentUid=$($res.agentUid)"
    return (Load-State)
}

function Send-Snapshot {
    param($Config, $State, $Inventory, [string]$Source = "PERIODIC")
    $baseUrl = $Config.BackendBaseUrl.TrimEnd('/')
    $headers = @{
        "X-Agent-Id"      = $State.agentUid
        "X-Agent-Token"   = $State.agentToken
        "Idempotency-Key" = [guid]::NewGuid().ToString()
    }
    $endpoint = if ($Source -eq "INITIAL") { "$baseUrl/api/v1/agent/inventory" } else { "$baseUrl/api/v1/agent/snapshot" }
    $Inventory["source"] = $Source
    $res = Invoke-ItamApi -Method "POST" -Url $endpoint -Headers $headers -Body $Inventory
    $nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Save-Status -StateText "ONLINE" -BackendUrl $baseUrl -AgentUid $State.agentUid -LastSnapshotAt $nowStr -LastError ""
    Write-AgentLog "Da gui Snapshot ($Source) thanh cong."
    return $res
}

function Send-Heartbeat {
    param($Config, $State, $Inventory)
    $baseUrl = $Config.BackendBaseUrl.TrimEnd('/')
    $headers = @{
        "X-Agent-Id"    = $State.agentUid
        "X-Agent-Token" = $State.agentToken
    }
    $nic = Get-PrimaryNic -Inventory $Inventory
    $usage = Get-CurrentUsage
    $body = [ordered]@{
        ipAddress      = if ($nic) { $nic.ipAddress } else { $null }
        agentVersion   = if ($Config.AgentVersion) { $Config.AgentVersion } else { "1.3.0" }
        cpuLoadPercent = $usage.cpu
        ramUsedPercent = $usage.ram
    }
    $res = Invoke-ItamApi -Method "POST" -Url "$baseUrl/api/v1/agent/heartbeat" -Headers $headers -Body $body
    $nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Save-Status -StateText "ONLINE" -BackendUrl $baseUrl -AgentUid $State.agentUid -LastHeartbeatAt $nowStr -LastError ""
    return $res
}

# ==================== MAIN ====================
try {
    $cfg = Load-Config
    Enable-SelfSignedCertIfAllowed -Allow ([bool]$cfg.AllowSelfSignedCert)
    $baseUrl = $cfg.BackendBaseUrl.TrimEnd('/')

    if ($Mode -eq "Once") {
        Write-AgentLog "Chay dong bo thu cong (Mode=Once)..."
        $inv = Collect-HardwareInventory
        $wasNew = -not (Test-Path $StatePath)
        $state = Ensure-Enrolled -Config $cfg -Inventory $inv
        Send-Snapshot -Config $cfg -State $state -Inventory $inv -Source $(if ($wasNew) { "INITIAL" } else { "MANUAL" }) | Out-Null
        Send-Heartbeat -Config $cfg -State $state -Inventory $inv | Out-Null
        Write-AgentLog "Hoan tat dong bo thu cong."
        exit 0
    }

    Write-AgentLog "Khoi dong ITAssetAgent Daemon (Server=$baseUrl)..."
    $heartbeatSec = if ($cfg.HeartbeatIntervalSec) { [int]$cfg.HeartbeatIntervalSec } else { 120 }
    $snapshotSec = if ($cfg.SnapshotIntervalSec) { [int]$cfg.SnapshotIntervalSec } else { 1800 }
    $lastSnapTime = [datetime]::MinValue
    $isFirstRun = -not (Test-Path $StatePath)

    while ($true) {
        try {
            $cfg = Load-Config
            $baseUrl = $cfg.BackendBaseUrl.TrimEnd('/')
            $needSnap = $isFirstRun -or (((Get-Date) - $lastSnapTime).TotalSeconds -ge $snapshotSec)

            if ($needSnap) {
                $inv = Collect-HardwareInventory
                $state = Ensure-Enrolled -Config $cfg -Inventory $inv
                Send-Snapshot -Config $cfg -State $state -Inventory $inv -Source $(if ($isFirstRun) { "INITIAL" } else { "PERIODIC" }) | Out-Null
                $lastSnapTime = Get-Date
                $isFirstRun = $false

                # Refresh intervals from server config
                try {
                    $srvCfg = Invoke-ItamApi -Method "GET" -Url "$baseUrl/api/v1/agent/config" -Headers @{
                        "X-Agent-Id"    = $state.agentUid
                        "X-Agent-Token" = $state.agentToken
                    }
                    if ($srvCfg.heartbeatIntervalSec -ge 30) { $heartbeatSec = [int]$srvCfg.heartbeatIntervalSec }
                    if ($srvCfg.fullSnapshotIntervalSec -ge 300) { $snapshotSec = [int]$srvCfg.fullSnapshotIntervalSec }
                } catch {}
            } else {
                $state = Load-State
                if (-not $state) {
                    $isFirstRun = $true
                    continue
                }
                $inv = [ordered]@{ networkAdapters = @() }
                $nics = @(Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter "IPEnabled=TRUE" -ErrorAction SilentlyContinue)
                foreach ($n in $nics) {
                    $ipv4 = @($n.IPAddress | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' }) | Select-Object -First 1
                    $inv.networkAdapters += [ordered]@{ ipAddress = $ipv4; isVirtual = ($n.Description -match "Virtual|Hyper-V|VMware|VPN|Loopback|WSL") }
                }
            }

            $hb = Send-Heartbeat -Config $cfg -State $state -Inventory $inv
            if ($hb -and $hb.commands) {
                foreach ($cmd in @($hb.commands)) {
                    if ($cmd.commandType -eq "SYNC_INVENTORY") {
                        Write-AgentLog "Nhan lenh SYNC_INVENTORY tu may chu..."
                        $freshInv = Collect-HardwareInventory
                        Send-Snapshot -Config $cfg -State $state -Inventory $freshInv -Source "ON_DEMAND" | Out-Null
                        $lastSnapTime = Get-Date
                    }
                }
            }
        } catch {
            $errText = $_.Exception.Message
            Write-AgentLog "Loi dong bo: $errText" "ERROR"
            Save-Status -StateText "ERROR" -BackendUrl $baseUrl -LastError $errText
        }

        Start-Sleep -Seconds ([math]::Max(30, $heartbeatSec))
    }
} catch {
    Write-AgentLog "Loi nghiem trong: $($_.Exception.Message)" "ERROR"
    Save-Status -StateText "ERROR" -BackendUrl "" -LastError $_.Exception.Message
    exit 1
}
