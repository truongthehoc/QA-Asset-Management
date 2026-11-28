using System.Diagnostics;
using System.Management;
using System.Net.NetworkInformation;
using Microsoft.Win32;
using ITAssetAgent.Models;

namespace ITAssetAgent.Services;

public class HardwareCollectorService
{
    private readonly ILogger<HardwareCollectorService> _logger;
    public HardwareCollectorService(ILogger<HardwareCollectorService> logger) => _logger = logger;

    public SnapshotPayload CollectHardware(string source = "PERIODIC")
    {
        var snap = new SnapshotPayload { Source = source, CollectedAt = DateTime.UtcNow };

        // System / SMBIOS UUID
        QueryWmi("SELECT UUID, Vendor, Name, IdentifyingNumber FROM Win32_ComputerSystemProduct", obj =>
        {
            snap.SmbiosUuid = obj["UUID"]?.ToString()?.Trim();
            snap.Manufacturer ??= obj["Vendor"]?.ToString()?.Trim();
            snap.Model ??= obj["Name"]?.ToString()?.Trim();
            snap.SerialNumber ??= obj["IdentifyingNumber"]?.ToString()?.Trim();
        });

        // Mainboard
        QueryWmi("SELECT Manufacturer, Product, SerialNumber FROM Win32_BaseBoard", obj =>
        {
            snap.MainboardMfg = obj["Manufacturer"]?.ToString()?.Trim();
            snap.MainboardProduct = obj["Product"]?.ToString()?.Trim();
            snap.MainboardSerial = obj["SerialNumber"]?.ToString()?.Trim();
        });

        // BIOS
        QueryWmi("SELECT Manufacturer, SMBIOSBIOSVersion, ReleaseDate, SerialNumber FROM Win32_BIOS", obj =>
        {
            snap.BiosMfg = obj["Manufacturer"]?.ToString()?.Trim();
            snap.BiosVersion = obj["SMBIOSBIOSVersion"]?.ToString()?.Trim();
            snap.BiosReleaseDate = obj["ReleaseDate"]?.ToString()?.Trim();
            snap.BiosSerial = obj["SerialNumber"]?.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(snap.SerialNumber)) snap.SerialNumber = snap.BiosSerial;
        });

        // CPU
        QueryWmi("SELECT Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor", obj =>
        {
            snap.Processors.Add(new ProcessorInfo
            {
                Name = obj["Name"]?.ToString()?.Trim() ?? "Unknown CPU",
                Manufacturer = obj["Manufacturer"]?.ToString()?.Trim(),
                Cores = Convert.ToInt32(obj["NumberOfCores"] ?? 0),
                LogicalProcessors = Convert.ToInt32(obj["NumberOfLogicalProcessors"] ?? 0),
                MaxClockMhz = Convert.ToInt32(obj["MaxClockSpeed"] ?? 0),
            });
        });

        // RAM Modules
        QueryWmi("SELECT DeviceLocator, Capacity, Speed, Manufacturer, SerialNumber, SMBIOSMemoryType FROM Win32_PhysicalMemory", obj =>
        {
            var capBytes = Convert.ToDouble(obj["Capacity"] ?? 0);
            var capGb = Math.Round(capBytes / (1024d * 1024d * 1024d), 2);
            var memTypeCode = Convert.ToInt32(obj["SMBIOSMemoryType"] ?? 0);
            var memType = memTypeCode switch { 26 => "DDR4", 34 => "DDR5", 24 => "DDR3", _ => "RAM" };
            snap.MemoryModules.Add(new MemoryModuleInfo
            {
                Slot = obj["DeviceLocator"]?.ToString()?.Trim(),
                CapacityGb = capGb,
                MemoryType = memType,
                SpeedMhz = Convert.ToInt32(obj["Speed"] ?? 0),
                Manufacturer = obj["Manufacturer"]?.ToString()?.Trim(),
                SerialNumber = obj["SerialNumber"]?.ToString()?.Trim(),
            });
        });
        snap.TotalRamGb = Math.Round(snap.MemoryModules.Sum(m => m.CapacityGb), 2);

        // Disks
        var diskByIndex = new Dictionary<int, string>();
        QueryWmi("SELECT Index, Model, SerialNumber, MediaType, InterfaceType, Size FROM Win32_DiskDrive", obj =>
        {
            var sizeBytes = Convert.ToDouble(obj["Size"] ?? 0);
            var model = obj["Model"]?.ToString()?.Trim() ?? "Unknown Disk";
            if (obj["Index"] != null)
            {
                diskByIndex[Convert.ToInt32(obj["Index"])] = model;
            }
            snap.Disks.Add(new DiskInfo
            {
                Model = model,
                SerialNumber = obj["SerialNumber"]?.ToString()?.Trim(),
                MediaType = obj["MediaType"]?.ToString()?.Trim() ?? obj["InterfaceType"]?.ToString()?.Trim(),
                SizeGb = Math.Round(sizeBytes / (1000d * 1000d * 1000d), 1),
            });
        });
        snap.TotalDiskGb = Math.Round(snap.Disks.Sum(d => d.SizeGb), 1);

        // Map LogicalDrive -> Physical Disk
        var driveToDisk = new Dictionary<string, (int Index, string Model)>(StringComparer.OrdinalIgnoreCase);
        QueryWmi("SELECT Antecedent, Dependent FROM Win32_LogicalDiskToPartition", obj =>
        {
            var ant = obj["Antecedent"]?.ToString() ?? "";
            var dep = obj["Dependent"]?.ToString() ?? "";
            var mDisk = System.Text.RegularExpressions.Regex.Match(ant, @"Disk #(\d+)");
            var mDrv = System.Text.RegularExpressions.Regex.Match(dep, @"DeviceID=""([A-Za-z]:)""");
            if (mDisk.Success && mDrv.Success)
            {
                var idx = int.Parse(mDisk.Groups[1].Value);
                var letter = mDrv.Groups[1].Value.ToUpper();
                var model = diskByIndex.TryGetValue(idx, out var m) ? m : $"Disk #{idx}";
                driveToDisk[letter] = (idx, model);
            }
        });

        // Logical Drives (C:, D:, E:, F: ...)
        QueryWmi("SELECT DeviceID, VolumeName, FileSystem, Size, FreeSpace FROM Win32_LogicalDisk WHERE DriveType = 3", obj =>
        {
            var letter = obj["DeviceID"]?.ToString()?.Trim().ToUpper();
            var sizeBytes = Convert.ToDouble(obj["Size"] ?? 0);
            var freeBytes = Convert.ToDouble(obj["FreeSpace"] ?? 0);
            if (string.IsNullOrEmpty(letter) || sizeBytes <= 0) return;

            var usedBytes = Math.Max(0, sizeBytes - freeBytes);
            var totalGb = Math.Round(sizeBytes / (1024d * 1024d * 1024d), 1);
            var freeGb = Math.Round(freeBytes / (1024d * 1024d * 1024d), 1);
            var usedGb = Math.Round(usedBytes / (1024d * 1024d * 1024d), 1);
            var usedPct = Math.Round((usedBytes / sizeBytes) * 100d, 1);
            var hasPhys = driveToDisk.TryGetValue(letter, out var phys);

            snap.LogicalDrives.Add(new LogicalDriveInfo
            {
                DriveLetter = letter,
                VolumeName = obj["VolumeName"]?.ToString()?.Trim(),
                FileSystem = obj["FileSystem"]?.ToString()?.Trim(),
                TotalGb = totalGb,
                UsedGb = usedGb,
                FreeGb = freeGb,
                UsedPercent = usedPct,
                DiskIndex = hasPhys ? phys.Index : null,
                DiskModel = hasPhys ? phys.Model : null,
            });
        });
        snap.LogicalDrives = snap.LogicalDrives.OrderBy(d => d.DriveLetter).ToList();

        // Laptop Battery Health & Wear Level (null on desktops)
        snap.Battery = CollectBatteryInfo();

        // GPU
        QueryWmi("SELECT Name, AdapterRAM, DriverVersion FROM Win32_VideoController", obj =>
        {
            var ramBytes = Convert.ToDouble(obj["AdapterRAM"] ?? 0);
            snap.Graphics.Add(new GraphicInfo
            {
                Name = obj["Name"]?.ToString()?.Trim() ?? "GPU",
                VramMb = (int)Math.Round(ramBytes / (1024d * 1024d)),
                DriverVersion = obj["DriverVersion"]?.ToString()?.Trim(),
            });
        });

        // Network Adapters
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            var ipProps = nic.GetIPProperties();
            var ipv4 = ipProps.UnicastAddresses
                .FirstOrDefault(u => u.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)?.Address.ToString();
            var mac = string.Join(":", nic.GetPhysicalAddress().GetAddressBytes().Select(b => b.ToString("X2")));
            var isVirtual = nic.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase)
                            || nic.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase)
                            || nic.Description.Contains("TAP", StringComparison.OrdinalIgnoreCase)
                            || nic.Description.Contains("VPN", StringComparison.OrdinalIgnoreCase);
            snap.NetworkAdapters.Add(new NetworkAdapterInfo
            {
                Name = nic.Description,
                MacAddress = string.IsNullOrEmpty(mac) ? null : mac,
                IpAddress = ipv4,
                SpeedMbps = nic.Speed > 0 ? (int)(nic.Speed / 1_000_000) : null,
                Status = nic.OperationalStatus == OperationalStatus.Up ? "UP" : "DOWN",
                IsVirtual = isVirtual,
            });
        }

        return snap;
    }

    private BatteryInfo? CollectBatteryInfo()
    {
        BatteryInfo? bat = null;
        QueryWmi("SELECT Name, BatteryStatus, EstimatedChargeRemaining, EstimatedRunTime, DesignCapacity, Chemistry FROM Win32_Battery", obj =>
        {
            if (bat != null) return;
            var statusCode = Convert.ToInt32(obj["BatteryStatus"] ?? 0);
            var status = statusCode switch
            {
                1 => "DISCHARGING",
                2 => "AC_CONNECTED",
                3 => "FULLY_CHARGED",
                4 => "LOW",
                5 => "CRITICAL",
                6 or 7 or 8 or 9 or 11 => "CHARGING",
                _ => "UNKNOWN",
            };
            var chemCode = Convert.ToInt32(obj["Chemistry"] ?? 0);
            var chem = chemCode switch
            {
                3 => "Lead Acid",
                4 => "NiCd",
                5 => "NiMH",
                6 => "Lithium-Ion",
                7 => "Zinc Air",
                8 => "Lithium Polymer",
                _ => "Li-Ion",
            };
            var runTime = Convert.ToInt64(obj["EstimatedRunTime"] ?? 0);
            var designFallback = Convert.ToInt32(obj["DesignCapacity"] ?? 0);

            bat = new BatteryInfo
            {
                Present = true,
                Name = obj["Name"]?.ToString()?.Trim() ?? "System Battery",
                Chemistry = chem,
                Status = status,
                ChargePercent = obj["EstimatedChargeRemaining"] != null ? Convert.ToInt32(obj["EstimatedChargeRemaining"]) : null,
                DesignCapacityMwh = designFallback > 0 ? designFallback : null,
                EstimatedRunTimeMin = (runTime > 0 && runTime < 100000) ? (int)runTime : null,
            };
        });

        if (bat == null) return null;

        try
        {
            using var sStatic = new ManagementObjectSearcher(@"root\wmi", "SELECT DesignedCapacity, ManufactureName, DeviceName FROM BatteryStaticData");
            foreach (ManagementObject o in sStatic.Get())
            {
                var dCap = Convert.ToInt32(o["DesignedCapacity"] ?? 0);
                if (dCap > 0) bat.DesignCapacityMwh = dCap;
                var mfg = o["ManufactureName"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(mfg)) bat.Manufacturer = mfg;
                var devName = o["DeviceName"]?.ToString()?.Trim();
                if (!string.IsNullOrEmpty(devName)) bat.Name = devName;
                break;
            }
        }
        catch { /* Desktop / WMI unsupported */ }

        try
        {
            using var sFull = new ManagementObjectSearcher(@"root\wmi", "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity");
            foreach (ManagementObject o in sFull.Get())
            {
                var fCap = Convert.ToInt32(o["FullChargedCapacity"] ?? 0);
                if (fCap > 0) bat.FullChargeCapacityMwh = fCap;
                break;
            }
        }
        catch { }

        try
        {
            using var sCycle = new ManagementObjectSearcher(@"root\wmi", "SELECT CycleCount FROM BatteryCycleCount");
            foreach (ManagementObject o in sCycle.Get())
            {
                var cyc = Convert.ToInt32(o["CycleCount"] ?? 0);
                if (cyc > 0) bat.CycleCount = cyc;
                break;
            }
        }
        catch { }

        if (bat.DesignCapacityMwh is > 0 && bat.FullChargeCapacityMwh is > 0)
        {
            var health = Math.Min(100d, Math.Round((double)bat.FullChargeCapacityMwh.Value / bat.DesignCapacityMwh.Value * 100d, 1));
            bat.HealthPercent = health;
            bat.WearLevelPercent = Math.Max(0d, Math.Round(100d - health, 1));
        }

        return bat;
    }

    private void QueryWmi(string query, Action<ManagementObject> handler)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(query);
            foreach (ManagementObject obj in searcher.Get())
            {
                handler(obj);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WMI query failed: {Query}", query);
        }
    }
}

public class OsLicenseCollectorService
{
    public OperatingSystemInfo CollectOsAndLicense()
    {
        var info = new OperatingSystemInfo();
        try
        {
            using var osSearcher = new ManagementObjectSearcher("SELECT Caption, Version, BuildNumber, OSArchitecture, InstallDate, LastBootUpTime FROM Win32_OperatingSystem");
            foreach (ManagementObject obj in osSearcher.Get())
            {
                info.ProductName = obj["Caption"]?.ToString()?.Trim() ?? "Windows";
                info.Version = obj["Version"]?.ToString()?.Trim();
                info.BuildNumber = obj["BuildNumber"]?.ToString()?.Trim();
                info.Architecture = obj["OSArchitecture"]?.ToString()?.Trim();
                if (obj["InstallDate"] is string inst) info.InstallDate = ManagementDateTimeConverter.ToDateTime(inst);
                if (obj["LastBootUpTime"] is string boot) info.LastBootTime = ManagementDateTimeConverter.ToDateTime(boot);
            }

            // SoftwareLicensingProduct - strictly PartialProductKey ONLY (SRS 4.6)
            using var licSearcher = new ManagementObjectSearcher(
                "SELECT Description, LicenseStatus, PartialProductKey FROM SoftwareLicensingProduct WHERE ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL");
            foreach (ManagementObject obj in licSearcher.Get())
            {
                var status = Convert.ToInt32(obj["LicenseStatus"] ?? 0);
                info.ActivationStatus = status == 1 ? "ACTIVATED" : status == 5 ? "NOTIFICATION" : "NOT_ACTIVATED";
                info.LicenseDescription = obj["Description"]?.ToString()?.Trim();
                var partial = obj["PartialProductKey"]?.ToString()?.Trim();
                info.PartialProductKey = partial is { Length: > 5 } ? partial[^5..] : partial;
                break;
            }
        }
        catch { /* Non-fatal if WMI licensing unavailable */ }
        return info;
    }
}

public class SoftwareCollectorService
{
    private static readonly (RegistryHive Hive, RegistryView View, string Arch)[] UninstallRoots =
    {
        (RegistryHive.LocalMachine, RegistryView.Registry64, "x64"),
        (RegistryHive.LocalMachine, RegistryView.Registry32, "x86"),
        (RegistryHive.CurrentUser, RegistryView.Registry64, "x64"),
    };

    public List<SoftwareItemInfo> CollectInstalledSoftware()
    {
        var list = new List<SoftwareItemInfo>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (hive, view, arch) in UninstallRoots)
        {
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                using var uninstallKey = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                if (uninstallKey == null) continue;

                foreach (var subName in uninstallKey.GetSubKeyNames())
                {
                    using var sub = uninstallKey.OpenSubKey(subName);
                    var displayName = sub?.GetValue("DisplayName")?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(displayName)) continue;
                    var sysComp = sub?.GetValue("SystemComponent");
                    if (sysComp != null && Convert.ToInt32(sysComp) == 1) continue;

                    var version = sub?.GetValue("DisplayVersion")?.ToString()?.Trim();
                    var dedupKey = $"{displayName}|{version}";
                    if (!seen.Add(dedupKey)) continue;

                    list.Add(new SoftwareItemInfo
                    {
                        DisplayName = displayName,
                        Publisher = sub?.GetValue("Publisher")?.ToString()?.Trim(),
                        DisplayVersion = version,
                        InstallDate = sub?.GetValue("InstallDate")?.ToString()?.Trim(),
                        InstallLocation = sub?.GetValue("InstallLocation")?.ToString()?.Trim(),
                        Architecture = arch,
                        UninstallEntry = subName,
                    });
                }
            }
            catch { /* Ignore inaccessible registry views */ }
        }
        return list.OrderBy(s => s.DisplayName).ToList();
    }
}

public class EventMonitorService
{
    public event Action<string, string>? OnRelevantSystemEvent;
    private EventLog? _appLog;

    public void Start()
    {
        try
        {
            // Listen for MsiInstaller events (11707 install / 11724 uninstall)
            _appLog = new EventLog("Application");
            _appLog.EntryWritten += (_, e) =>
            {
                if (e.Entry.Source == "MsiInstaller" && (e.Entry.InstanceId == 11707 || e.Entry.InstanceId == 11724))
                {
                    OnRelevantSystemEvent?.Invoke("SOFTWARE", e.Entry.Message);
                }
            };
            _appLog.EnableRaisingEvents = true;
        }
        catch { /* Requires Windows Service / Admin privilege */ }
    }
}
