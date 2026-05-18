using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

namespace MusicAgentWinForms;

public class MainForm : Form
{
    private WebView2 webView;
    private AudioService audioService;
    private DatabaseService dbService;
    private FileService fileService;

    public MainForm()
    {
        this.Text = "MusicAgent";
        this.Size = new Size(1400, 900);
        this.StartPosition = FormStartPosition.CenterScreen;
        InitializeWebView();
        InitializeServices();
    }

    private void InitializeWebView()
    {
        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(webView);
        webView.CoreWebView2InitializationCompleted += WebView_CoreWebView2InitializationCompleted;
        InitializeAsync();
    }

    private async void InitializeAsync()
    {
        await webView.EnsureCoreWebView2Async(null);
    }

    private void InitializeServices()
    {
        audioService = new AudioService();
        dbService = new DatabaseService();
        fileService = new FileService();
    }

    private void WebView_CoreWebView2InitializationCompleted(object? sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

            var distPath = Path.Combine(Application.StartupPath, "dist");
            var wwwrootPath = Path.Combine(Application.StartupPath, "wwwroot");
            var targetPath = Directory.Exists(distPath) ? distPath : wwwrootPath;

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "musicagent.app",
                targetPath,
                CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.Navigate("https://musicagent.app/index.html");
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var message = e.TryGetWebMessageAsString();
            var request = JsonSerializer.Deserialize<WebMessageRequest>(message);
            if (request == null) return;

            var response = HandleRequest(request);
            var responseJson = JsonSerializer.Serialize(response);
            webView.CoreWebView2?.PostWebMessageAsString(responseJson);
        }
        catch (Exception ex)
        {
            var errorResponse = new WebMessageResponse
            {
                Id = "",
                Action = "error",
                Data = ex.Message
            };
            webView.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(errorResponse));
        }
    }

    private WebMessageResponse HandleRequest(WebMessageRequest request)
    {
        return request.Action switch
        {
            "play" => audioService.Play(request.Data),
            "pause" => audioService.Pause(),
            "resume" => audioService.Resume(),
            "stop" => audioService.Stop(),
            "setVolume" => audioService.SetVolume(request.Data),
            "setProgress" => audioService.SetProgress(request.Data),
            "getProgress" => audioService.GetProgress(),
            "scanFolder" => fileService.ScanFolder(request.Data),
            "getLocalPaths" => fileService.GetLocalPaths(),
            "addLocalPath" => fileService.AddLocalPath(request.Data),
            "removeLocalPath" => fileService.RemoveLocalPath(request.Data),
            "getPlaylists" => dbService.GetPlaylists(),
            "getTracks" => dbService.GetTracks(request.Data),
            "savePlaylist" => dbService.SavePlaylist(request.Data),
            "getSettings" => dbService.GetSettings(),
            "saveSettings" => dbService.SaveSettings(request.Data),
            "getWeeklyData" => dbService.GetWeeklyData(),
            "getPlatformData" => dbService.GetPlatformData(),
            _ => new WebMessageResponse { Id = request.Id, Action = request.Action, Data = "Unknown action" }
        };
    }
}

public class WebMessageRequest
{
    public string Id { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}

public class WebMessageResponse
{
    public string Id { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public object Data { get; set; } = string.Empty;
}
