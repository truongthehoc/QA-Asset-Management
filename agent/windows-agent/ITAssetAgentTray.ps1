<#
.SYNOPSIS
    IT Asset Management - System Tray Status & Quick Sync UI (WinForms)
.DESCRIPTION
    Hien thi bieu tuong nho o khay he thong Windows (System Tray) giup IT xem trang thai Agent,
    mo file config.json, xem nhat ky agent.log va bam Dong bo ngay (Sync Now).
#>
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = "C:\ProgramData\ITAssetAgent"
$ConfigPath = Join-Path $DataDir "config.json"
$StatusPath = Join-Path $DataDir "status.json"
$LogFile = Join-Path $DataDir "logs\agent.log"
$AgentScript = Join-Path $InstallDir "ITAssetAgent.ps1"

# Ensure single Tray instance per user session
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, "Global\ITAssetAgentTraySingleInstance", [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

$script:StatusForm = $null

function Read-AgentStatus {
    if (Test-Path $StatusPath) {
        try { return (Get-Content -Path $StatusPath -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {}
    }
    return $null
}

function Format-StatusText {
    $st = Read-AgentStatus
    $cfg = $null
    if (Test-Path $ConfigPath) {
        try { $cfg = Get-Content -Path $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    }
    $statusText = if ($st -and $st.status -eq "ONLINE") { "Truc tuyen (ONLINE)" } elseif ($st -and $st.status -eq "ERROR") { "Loi ket noi (ERROR)" } else { "Chua dong bo" }
    $infoLines = @(
        "May tram      : $($env:COMPUTERNAME)",
        "Trang thai    : $statusText",
        "May chu       : $(if ($cfg) { $cfg.BackendBaseUrl } elseif ($st) { $st.backendUrl } else { 'Chua cau hinh' })",
        "Agent UID     : $(if ($st -and $st.agentUid) { $st.agentUid } else { 'Chua dang ky' })",
        "Snapshot cuoi : $(if ($st -and $st.lastSnapshotAt) { $st.lastSnapshotAt } else { '—' })",
        "Heartbeat cuoi: $(if ($st -and $st.lastHeartbeatAt) { $st.lastHeartbeatAt } else { '—' })"
    )
    if ($st -and $st.lastError) {
        $infoLines += "Loi gan nhat  : $($st.lastError)"
    }
    return ($infoLines -join "`r`n")
}

function Show-StatusDialog {
    if ($null -ne $script:StatusForm -and -not $script:StatusForm.IsDisposed) {
        $script:StatusForm.Activate()
        return
    }

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "IT Asset Management Agent"
    $form.Size = New-Object System.Drawing.Size(440, 310)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.BackColor = [System.Drawing.Color]::White
    $script:StatusForm = $form

    $fontTitle = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Segoe UI", 9)

    $lblHeader = New-Object System.Windows.Forms.Label
    $lblHeader.Text = "IT Asset Management - Windows Agent"
    $lblHeader.Font = $fontTitle
    $lblHeader.ForeColor = [System.Drawing.Color]::FromArgb(0, 110, 150)
    $lblHeader.Location = New-Object System.Drawing.Point(16, 14)
    $lblHeader.Size = New-Object System.Drawing.Size(400, 24)
    $form.Controls.Add($lblHeader)

    $txtInfo = New-Object System.Windows.Forms.TextBox
    $txtInfo.Multiline = $true
    $txtInfo.ReadOnly = $true
    $txtInfo.BorderStyle = "FixedSingle"
    $txtInfo.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)
    $txtInfo.Font = New-Object System.Drawing.Font("Consolas", 9)
    $txtInfo.Location = New-Object System.Drawing.Point(16, 48)
    $txtInfo.Size = New-Object System.Drawing.Size(392, 165)
    $txtInfo.Text = Format-StatusText
    $form.Controls.Add($txtInfo)

    $btnSync = New-Object System.Windows.Forms.Button
    $btnSync.Text = "Dong bo ngay"
    $btnSync.Font = $fontBody
    $btnSync.BackColor = [System.Drawing.Color]::FromArgb(0, 110, 150)
    $btnSync.ForeColor = [System.Drawing.Color]::White
    $btnSync.FlatStyle = "Flat"
    $btnSync.Location = New-Object System.Drawing.Point(16, 226)
    $btnSync.Size = New-Object System.Drawing.Size(120, 32)
    $btnSync.Add_Click({
        $btnSync.Enabled = $false
        $btnSync.Text = "Dang dong bo..."
        $form.Refresh()
        [System.Windows.Forms.Application]::DoEvents()
        try {
            Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScript`" -Mode Once -ConfigPath `"$ConfigPath`"" -Wait
        } finally {
            $txtInfo.Text = Format-StatusText
            $btnSync.Text = "Dong bo ngay"
            $btnSync.Enabled = $true
            $form.Refresh()
        }
    })
    $form.Controls.Add($btnSync)

    $btnCfg = New-Object System.Windows.Forms.Button
    $btnCfg.Text = "Mo config.json"
    $btnCfg.Font = $fontBody
    $btnCfg.Location = New-Object System.Drawing.Point(146, 226)
    $btnCfg.Size = New-Object System.Drawing.Size(120, 32)
    $btnCfg.Add_Click({
        if (Test-Path $ConfigPath) { Start-Process notepad.exe -ArgumentList "`"$ConfigPath`"" }
    })
    $form.Controls.Add($btnCfg)

    $btnLog = New-Object System.Windows.Forms.Button
    $btnLog.Text = "Xem Log"
    $btnLog.Font = $fontBody
    $btnLog.Location = New-Object System.Drawing.Point(276, 226)
    $btnLog.Size = New-Object System.Drawing.Size(132, 32)
    $btnLog.Add_Click({
        if (Test-Path $LogFile) { Start-Process notepad.exe -ArgumentList "`"$LogFile`"" }
        else { [System.Windows.Forms.MessageBox]::Show("Chua co file nhat ky.", "IT Asset Agent") }
    })
    $form.Controls.Add($btnLog)

    $form.Add_FormClosed({
        $script:StatusForm = $null
    })

    [void]$form.ShowDialog()
}

# Build NotifyIcon
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Shield
$tray.Text = "IT Asset Management Agent"
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$itemStatus = $menu.Items.Add("Xem trang thai Agent")
$itemSync = $menu.Items.Add("Dong bo ngay (Sync Now)")
$menu.Items.Add("-") | Out-Null
$itemConfig = $menu.Items.Add("Mo file cau hinh (config.json)")
$itemLog = $menu.Items.Add("Xem nhat ky (agent.log)")
$menu.Items.Add("-") | Out-Null
$itemExit = $menu.Items.Add("An bieu tuong khay")

$itemStatus.Add_Click({ Show-StatusDialog })
$itemSync.Add_Click({
    $tray.ShowBalloonTip(2500, "IT Asset Agent", "Dang thu thap va dong bo cau hinh may tram...", [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentScript`" -Mode Once -ConfigPath `"$ConfigPath`"" -Wait
    $st = Read-AgentStatus
    if ($st -and $st.status -eq "ONLINE") {
        $tray.ShowBalloonTip(3000, "IT Asset Agent", "Dong bo thanh cong! ($($st.agentUid))", [System.Windows.Forms.ToolTipIcon]::Info)
    } else {
        $tray.ShowBalloonTip(4000, "IT Asset Agent", "Dong bo that bai: $($st.lastError)", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
})
$itemConfig.Add_Click({
    if (Test-Path $ConfigPath) { Start-Process notepad.exe -ArgumentList "`"$ConfigPath`"" }
})
$itemLog.Add_Click({
    if (Test-Path $LogFile) { Start-Process notepad.exe -ArgumentList "`"$LogFile`"" }
})
$itemExit.Add_Click({
    $tray.Visible = $false
    $tray.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.Add_DoubleClick({ Show-StatusDialog })

[System.Windows.Forms.Application]::Run()
