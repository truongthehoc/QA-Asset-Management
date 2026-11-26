namespace ITAssetAgent.Models;

public record AgentIdentity(string AgentUid, string AgentToken);

public record AgentScheduleConfig(
    int HeartbeatIntervalSec = 300,
    int HardwareIntervalSec = 1800,
    int SoftwareIntervalSec = 21600,
    int LicenseIntervalSec = 86400,
    int FullSnapshotIntervalSec = 86400,
    int JitterMaxSec = 60
);

public class ProcessorInfo
{
    public string Name { get; set; } = "";
    public string? Manufacturer { get; set; }
    public int? Cores { get; set; }
    public int? LogicalProcessors { get; set; }
    public int? MaxClockMhz { get; set; }
}

public class MemoryModuleInfo
{
    public string? Slot { get; set; }
    public double CapacityGb { get; set; }
    public string? MemoryType { get; set; }
    public int? SpeedMhz { get; set; }
    public string? Manufacturer { get; set; }
    public string? SerialNumber { get; set; }
}

public class DiskInfo
{
    public string Model { get; set; } = "";
    public string? SerialNumber { get; set; }
    public string? MediaType { get; set; }
    public double SizeGb { get; set; }
    public double? FreeGb { get; set; }
    public string? Partitions { get; set; }
}

public class NetworkAdapterInfo
{
    public string Name { get; set; } = "";
    public string? MacAddress { get; set; }
    public string? IpAddress { get; set; }
    public int? SpeedMbps { get; set; }
    public string? Status { get; set; }
    public bool IsVirtual { get; set; }
}

public class GraphicInfo
{
    public string Name { get; set; } = "";
    public int? VramMb { get; set; }
    public string? DriverVersion { get; set; }
}

public class MonitorInfo
{
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public string? Resolution { get; set; }
}

public class OperatingSystemInfo
{
    public string ProductName { get; set; } = "";
    public string? Edition { get; set; }
    public string? Version { get; set; }
    public string? BuildNumber { get; set; }
    public string? Architecture { get; set; }
    public DateTime? InstallDate { get; set; }
    public DateTime? LastBootTime { get; set; }
    public string ActivationStatus { get; set; } = "UNKNOWN";
    public string? LicenseDescription { get; set; }
    public string? LicenseChannel { get; set; }
    // SRS 4.6 & 11.3: ONLY max 5-char partial product key; NEVER collect full product key
    public string? PartialProductKey { get; set; }
}

public class SoftwareItemInfo
{
    public string DisplayName { get; set; } = "";
    public string? Publisher { get; set; }
    public string? DisplayVersion { get; set; }
    public string? InstallDate { get; set; }
    public string? InstallLocation { get; set; }
    public string? Architecture { get; set; }
    public string? UninstallEntry { get; set; }
}

public class SnapshotPayload
{
    public string Source { get; set; } = "PERIODIC";
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
    public string ComputerName { get; set; } = Environment.MachineName;
    public string Hostname { get; set; } = System.Net.Dns.GetHostName();
    public string? SmbiosUuid { get; set; }
    public string? SerialNumber { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? MainboardMfg { get; set; }
    public string? MainboardProduct { get; set; }
    public string? MainboardSerial { get; set; }
    public string? BiosMfg { get; set; }
    public string? BiosVersion { get; set; }
    public string? BiosReleaseDate { get; set; }
    public string? BiosSerial { get; set; }
    public double TotalRamGb { get; set; }
    public double TotalDiskGb { get; set; }
    public List<ProcessorInfo> Processors { get; set; } = new();
    public List<MemoryModuleInfo> MemoryModules { get; set; } = new();
    public List<DiskInfo> Disks { get; set; } = new();
    public List<NetworkAdapterInfo> NetworkAdapters { get; set; } = new();
    public List<GraphicInfo> Graphics { get; set; } = new();
    public List<MonitorInfo> Monitors { get; set; } = new();
    public OperatingSystemInfo? OperatingSystem { get; set; }
    public List<SoftwareItemInfo> Software { get; set; } = new();
}
