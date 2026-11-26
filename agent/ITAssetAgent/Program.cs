using ITAssetAgent;
using ITAssetAgent.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "ITAssetManagementAgent";
});

builder.Services.AddHttpClient<BackendApiClient>(client =>
{
    var baseUrl = builder.Configuration["Agent:BackendBaseUrl"] ?? "http://localhost:3001";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<AgentIdentityService>();
builder.Services.AddSingleton<LocalQueueService>();
builder.Services.AddSingleton<HardwareCollectorService>();
builder.Services.AddSingleton<OsLicenseCollectorService>();
builder.Services.AddSingleton<SoftwareCollectorService>();
builder.Services.AddSingleton<EventMonitorService>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
