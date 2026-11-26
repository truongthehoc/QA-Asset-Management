using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ITAssetAgent.Models;

namespace ITAssetAgent.Services;

public class AgentIdentityService
{
    private readonly string _identityPath;

    public AgentIdentityService(IConfiguration config)
    {
        var dir = config["Agent:DataDirectory"] ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ITAssetAgent");
        Directory.CreateDirectory(dir);
        _identityPath = Path.Combine(dir, "identity.dat");
    }

    public AgentIdentity? Load()
    {
        if (!File.Exists(_identityPath)) return null;
        var encrypted = File.ReadAllBytes(_identityPath);
        var plain = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.LocalMachine);
        return JsonSerializer.Deserialize<AgentIdentity>(Encoding.UTF8.GetString(plain));
    }

    public void Save(AgentIdentity identity)
    {
        var json = JsonSerializer.Serialize(identity);
        var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(json), null, DataProtectionScope.LocalMachine);
        File.WriteAllBytes(_identityPath, encrypted);
    }
}

public class LocalQueueService
{
    private readonly string _queueDir;

    public LocalQueueService(IConfiguration config)
    {
        var dir = config["Agent:DataDirectory"] ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ITAssetAgent");
        _queueDir = Path.Combine(dir, "queue");
        Directory.CreateDirectory(_queueDir);
    }

    public void Enqueue(string endpoint, string idempotencyKey, object payload)
    {
        var file = Path.Combine(_queueDir, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{idempotencyKey}.json");
        var envelope = new { endpoint, idempotencyKey, payload };
        File.WriteAllText(file, JsonSerializer.Serialize(envelope));
    }

    public IEnumerable<string> GetPendingFiles() => Directory.GetFiles(_queueDir, "*.json").OrderBy(f => f);
    public void Remove(string path) { if (File.Exists(path)) File.Delete(path); }
}

public class BackendApiClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;

    public BackendApiClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        _config = config;
    }

    public async Task<AgentIdentity?> EnrollAsync(SnapshotPayload initialSnap, CancellationToken ct)
    {
        var token = _config["Agent:EnrollmentToken"];
        if (string.IsNullOrWhiteSpace(token)) return null;

        var primaryNic = initialSnap.NetworkAdapters.FirstOrDefault(n => !n.IsVirtual && !string.IsNullOrEmpty(n.IpAddress));
        var res = await _http.PostAsJsonAsync("api/v1/agent/enroll", new
        {
            enrollmentToken = token,
            hostname = initialSnap.Hostname,
            computerName = initialSnap.ComputerName,
            smbiosUuid = initialSnap.SmbiosUuid,
            biosSerial = initialSnap.SerialNumber,
            primaryMac = primaryNic?.MacAddress,
            ipAddress = primaryNic?.IpAddress,
            manufacturer = initialSnap.Manufacturer,
            model = initialSnap.Model,
            osSummary = initialSnap.OperatingSystem?.ProductName,
            agentVersion = _config["Agent:Version"] ?? "1.2.0",
        }, ct);

        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        return new AgentIdentity(
            body.GetProperty("agentUid").GetString()!,
            body.GetProperty("agentToken").GetString()!
        );
    }

    public async Task<List<string>> SendHeartbeatAsync(AgentIdentity id, string? ip, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "api/v1/agent/heartbeat");
        req.Headers.Add("X-Agent-Id", id.AgentUid);
        req.Headers.Add("X-Agent-Token", id.AgentToken);
        req.Content = JsonContent.Create(new { ipAddress = ip, agentVersion = _config["Agent:Version"] ?? "1.2.0" });
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var cmds = new List<string>();
        if (json.TryGetProperty("commands", out var arr))
        {
            foreach (var c in arr.EnumerateArray())
            {
                var t = c.GetProperty("type").GetString();
                if (!string.IsNullOrEmpty(t)) cmds.Add(t);
            }
        }
        return cmds;
    }

    public async Task SendSnapshotAsync(AgentIdentity id, SnapshotPayload snap, string idempotencyKey, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "api/v1/agent/snapshot");
        req.Headers.Add("X-Agent-Id", id.AgentUid);
        req.Headers.Add("X-Agent-Token", id.AgentToken);
        req.Headers.Add("Idempotency-Key", idempotencyKey);
        req.Content = JsonContent.Create(snap);
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task<AgentScheduleConfig> FetchConfigAsync(AgentIdentity id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "api/v1/agent/config");
        req.Headers.Add("X-Agent-Id", id.AgentUid);
        req.Headers.Add("X-Agent-Token", id.AgentToken);
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<AgentScheduleConfig>(cancellationToken: ct) ?? new AgentScheduleConfig();
    }
}
