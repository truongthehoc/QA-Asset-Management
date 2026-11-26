using ITAssetAgent.Models;
using ITAssetAgent.Services;

namespace ITAssetAgent;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly AgentIdentityService _identityService;
    private readonly LocalQueueService _queue;
    private readonly BackendApiClient _api;
    private readonly HardwareCollectorService _hw;
    private readonly OsLicenseCollectorService _os;
    private readonly SoftwareCollectorService _sw;
    private readonly EventMonitorService _eventMonitor;
    private readonly Random _rng = new();

    private AgentIdentity? _identity;
    private AgentScheduleConfig _schedule = new();
    private DateTime _lastSnapshotUtc = DateTime.MinValue;
    private bool _triggerImmediateSync;

    public Worker(
        ILogger<Worker> logger,
        AgentIdentityService identityService,
        LocalQueueService queue,
        BackendApiClient api,
        HardwareCollectorService hw,
        OsLicenseCollectorService os,
        SoftwareCollectorService sw,
        EventMonitorService eventMonitor)
    {
        _logger = logger;
        _identityService = identityService;
        _queue = queue;
        _api = api;
        _hw = hw;
        _os = os;
        _sw = sw;
        _eventMonitor = eventMonitor;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("IT Asset Management Windows Agent started on {Host}", Environment.MachineName);
        _eventMonitor.OnRelevantSystemEvent += (comp, msg) =>
        {
            _logger.LogInformation("Detected Windows event [{Comp}], scheduling inventory sync.", comp);
            _triggerImmediateSync = true;
        };
        _eventMonitor.Start();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_identity == null)
                {
                    _identity = _identityService.Load();
                    if (_identity == null)
                    {
                        var initSnap = BuildFullSnapshot("INITIAL");
                        _identity = await _api.EnrollAsync(initSnap, stoppingToken);
                        if (_identity != null)
                        {
                            _identityService.Save(_identity);
                            await _api.SendSnapshotAsync(_identity, initSnap, Guid.NewGuid().ToString("N"), stoppingToken);
                            _lastSnapshotUtc = DateTime.UtcNow;
                            _logger.LogInformation("Enrolled successfully as {Uid}", _identity.AgentUid);
                        }
                    }
                }

                if (_identity != null)
                {
                    // Fetch backend-driven schedule config
                    try { _schedule = await _api.FetchConfigAsync(_identity, stoppingToken); } catch { }

                    // Send Heartbeat and handle strictly allowlisted commands ONLY (SRS 11.3)
                    var cmds = await _api.SendHeartbeatAsync(_identity, null, stoppingToken);
                    if (cmds.Contains("SYNC_INVENTORY") || cmds.Contains("SYNC_SOFTWARE"))
                    {
                        _triggerImmediateSync = true;
                    }

                    // Periodic or event-triggered snapshot
                    var elapsed = (DateTime.UtcNow - _lastSnapshotUtc).TotalSeconds;
                    if (_triggerImmediateSync || elapsed >= _schedule.HardwareIntervalSec)
                    {
                        var snap = BuildFullSnapshot(_triggerImmediateSync ? "EVENT_TRIGGERED" : "PERIODIC");
                        var key = Guid.NewGuid().ToString("N");
                        try
                        {
                            await _api.SendSnapshotAsync(_identity, snap, key, stoppingToken);
                            _lastSnapshotUtc = DateTime.UtcNow;
                            _triggerImmediateSync = false;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Backend unreachable; queueing snapshot locally for retry.");
                            _queue.Enqueue("api/v1/agent/snapshot", key, snap);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Agent cycle error; will retry after backoff.");
            }

            // Jitter to avoid thundering herd across all endpoints (SRS 5.7)
            var jitter = _rng.Next(0, Math.Max(5, _schedule.JitterMaxSec));
            await Task.Delay(TimeSpan.FromSeconds(_schedule.HeartbeatIntervalSec + jitter), stoppingToken);
        }
    }

    private SnapshotPayload BuildFullSnapshot(string source)
    {
        var snap = _hw.CollectHardware(source);
        snap.OperatingSystem = _os.CollectOsAndLicense();
        snap.Software = _sw.CollectInstalledSoftware();
        return snap;
    }
}
