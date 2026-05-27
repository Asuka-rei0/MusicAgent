using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

namespace MusicAgentWinForms;

public class MainForm : Form
{
    private WebView2 webView = null!;
    private AudioService audioService = null!;
    private DatabaseService dbService = null!;
    private FileService fileService = null!;
    private NeteaseService neteaseService = null!;
    private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true };

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
        dbService = new DatabaseService();
        fileService = new FileService();
        neteaseService = NeteaseService.Create();
        audioService = new AudioService(neteaseService);
    }

    private void WebView_CoreWebView2InitializationCompleted(object? sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "musicagent.app",
                Path.Combine(Application.StartupPath, "wwwroot"),
                CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.Navigate("https://musicagent.app/index.html");
        }
    }

    private async void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var message = e.TryGetWebMessageAsString();
            var request = JsonSerializer.Deserialize<WebMessageRequest>(message, jsonOptions);
            if (request == null) return;

            var response = await HandleRequestAsync(request);
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

    private async Task<WebMessageResponse> HandleRequestAsync(WebMessageRequest request)
    {
        var id = request.Id;
        return request.Action switch
        {
            "neteaseQrStart" => await neteaseService.StartQrLoginAsync(id),
            "neteaseQrCheck" => await neteaseService.CheckQrLoginAsync(id),
            "syncNetease" => await neteaseService.SyncAsync(id),
            "play" => WithId(await audioService.PlayAsync(request.Data), id),
            "pause" => WithId(audioService.Pause(), id),
            "resume" => WithId(audioService.Resume(), id),
            "stop" => WithId(audioService.Stop(), id),
            "next" => WithId(await audioService.NextAsync(), id),
            "previous" => WithId(await audioService.PreviousAsync(), id),
            "setQueue" => WithId(await audioService.SetQueueAsync(request.Data), id),
            "setPlaybackStrategy" => WithId(audioService.SetPlaybackStrategy(request.Data), id),
            "setVolume" => WithId(audioService.SetVolume(request.Data), id),
            "setProgress" => WithId(audioService.SetProgress(request.Data), id),
            "getProgress" => WithId(audioService.GetProgress(), id),
            "getAudioState" => WithId(audioService.GetState(), id),
            "scanFolder" => WithId(fileService.ScanFolder(request.Data), id),
            "getLocalPaths" => WithId(fileService.GetLocalPaths(), id),
            "addLocalPath" => WithId(fileService.AddLocalPath(request.Data), id),
            "removeLocalPath" => WithId(fileService.RemoveLocalPath(request.Data), id),
            "getLyrics" => WithId(await GetLyricsAsync(request.Data), id),
            "getSettings" => WithId(dbService.GetSettings(), id),
            "saveSettings" => WithId(dbService.SaveSettings(request.Data), id),
            "savePlaybackState" => WithId(dbService.SavePlaybackState(request.Data), id),
            "getWeeklyData" => WithId(dbService.GetWeeklyData(), id),
            "getPlatformData" => WithId(dbService.GetPlatformData(), id),
            "getListeningInsights" => WithId(dbService.GetListeningInsights(), id),
            "recordListeningTime" => WithId(dbService.RecordListeningTime(request.Data), id),
            "getNeteaseStatus" => neteaseService.GetStatus(id),
            "setNeteaseApiBaseUrl" => neteaseService.SetApiBaseUrl(request.Data, id),
            "neteaseLogout" => neteaseService.Logout(id),
            "getNeteasePlaylists" => neteaseService.GetPlaylists(id),
            "getNeteasePlaylistTracks" => await neteaseService.GetPlaylistTracksAsync(request.Data, id),
            "searchNeteaseSongs" => await neteaseService.SearchSongsAsync(request.Data, id),
            "getNeteaseTopCharts" => await neteaseService.GetTopChartsAsync(id),
            "getNeteaseMoodTags" => await neteaseService.GetMoodTagsAsync(id),
            "getNeteaseExploreTracks" => await neteaseService.GetExploreTracksAsync(request.Data, id),
            "getNeteaseMoodTracks" => await neteaseService.GetMoodTracksAsync(request.Data, id),
            _ => new WebMessageResponse { Id = id, Action = request.Action, Data = "Unknown action" }
        };
    }

    private async Task<WebMessageResponse> GetLyricsAsync(string data)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            if (!doc.RootElement.TryGetProperty("filePath", out var pathProp))
            {
                return fileService.GetLyrics(data);
            }

            var path = pathProp.GetString() ?? string.Empty;
            if (NeteaseService.TryParseNeteaseSource(path, out var songId))
            {
                return await neteaseService.GetLyricsAsync(path, songId);
            }

            return fileService.GetLyrics(data);
        }
        catch
        {
            return fileService.GetLyrics(data);
        }
    }

    private static WebMessageResponse WithId(WebMessageResponse response, string id)
    {
        response.Id = id;
        return response;
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
    public string action => Action;
    public object data => Data;
}
