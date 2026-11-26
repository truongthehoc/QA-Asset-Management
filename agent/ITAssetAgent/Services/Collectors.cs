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
        QueryWmi("SELECT Model, SerialNumber, MediaType, InterfaceType, Size FROM Win32_DiskDrive", obj =>
        {
            var sizeBytes = Convert.ToDouble(obj["Size"] ?? 0);
            snap.Disks.Add(new DiskInfo
            {
                Model = obj["Model"]?.ToString()?.Trim() ?? "Unknown Disk",
                SerialNumber = obj["SerialNumber"]?.ToString()?.Trim(),
                MediaType = obj["MediaType"]?.ToString()?.Trim() ?? obj["InterfaceType"]?.ToString()?.Trim(),
                SizeGb = Math.Round(sizeBytes / (1000d * 1000d * 1000d), 1),
            });
        });
        snap.TotalDiskGb = Math.Round(snap.Disks.Sum(d => d.SizeGb), 1);

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
