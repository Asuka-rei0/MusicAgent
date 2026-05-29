using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace MusicAgentWinForms;

public class MainForm : Form
{
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaCaptionColor = 35;
    private const int DwmwaTextColor = 36;
    private const int DwmColorNone = unchecked((int)0xFFFFFFFE);
    private static readonly Color WindowChromeColor = Color.FromArgb(10, 10, 15);
    private static readonly Color WindowChromeTextColor = Color.FromArgb(229, 231, 235);

    private WebView2 webView = null!;
    private AudioService audioService = null!;
    private DatabaseService dbService = null!;
    private FileService fileService = null!;
    private NeteaseService neteaseService = null!;
    private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private bool isImmersiveFullscreen;
    private FormBorderStyle previousFormBorderStyle;
    private FormWindowState previousWindowState;
    private Rectangle previousBounds;
    private bool previousTopMost;
    private DesktopLyricsForm? desktopLyricsForm;
    private DesktopLyricsPayload lastDesktopLyricsPayload = new();
    private bool isDesktopLyricsClosedByUser;

    public MainForm()
    {
        this.Text = "MusicAgent";
        this.Size = new Size(1400, 900);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = WindowChromeColor;
        var appIcon = LoadAppIcon();
        if (appIcon != null)
        {
            this.Icon = appIcon;
        }
        InitializeWebView();
        InitializeServices();
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int attributeValue, int attributeSize);

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyWindowChrome();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        desktopLyricsForm?.Close();
        desktopLyricsForm?.Dispose();
        neteaseService?.Dispose();
        base.OnFormClosed(e);
    }

    private void ApplyWindowChrome()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10))
        {
            return;
        }

        try
        {
            var darkMode = 1;
            DwmSetWindowAttribute(Handle, DwmwaUseImmersiveDarkMode, ref darkMode, sizeof(int));

            var captionColor = ToColorRef(WindowChromeColor);
            DwmSetWindowAttribute(Handle, DwmwaCaptionColor, ref captionColor, sizeof(int));

            var textColor = ToColorRef(WindowChromeTextColor);
            DwmSetWindowAttribute(Handle, DwmwaTextColor, ref textColor, sizeof(int));

            var borderColor = DwmColorNone;
            DwmSetWindowAttribute(Handle, DwmwaBorderColor, ref borderColor, sizeof(int));
        }
        catch
        {
            // Older Windows builds can ignore unsupported DWM attributes.
        }
    }

    private static int ToColorRef(Color color)
    {
        return color.R | (color.G << 8) | (color.B << 16);
    }

    private static Icon? LoadAppIcon()
    {
        var iconPath = Path.Combine(Application.StartupPath, "wwwroot", "favicon.ico");
        return File.Exists(iconPath) ? new Icon(iconPath) : null;
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
            "enterImmersivePlayer" => SetImmersiveFullscreen(true, id),
            "exitImmersivePlayer" => SetImmersiveFullscreen(false, id),
            "setDesktopLyricsEnabled" => SetDesktopLyricsEnabled(request.Data, id),
            "updateDesktopLyrics" => UpdateDesktopLyrics(request.Data, id),
            _ => new WebMessageResponse { Id = id, Action = request.Action, Data = "Unknown action" }
        };
    }

    private WebMessageResponse SetDesktopLyricsEnabled(string data, string id)
    {
        try
        {
            var payload = ReadDesktopLyricsPayload(data);
            var enabled = payload.Enabled;
            lastDesktopLyricsPayload = payload;
            lastDesktopLyricsPayload.Enabled = enabled;
            isDesktopLyricsClosedByUser = false;

            if (enabled)
            {
                try
                {
                    var lyricsForm = EnsureDesktopLyricsForm();
                    lyricsForm.UpdateLyrics(lastDesktopLyricsPayload);
                    lyricsForm.ShowLyrics();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"桌面歌词显示失败: {ex.Message}");
                    return new WebMessageResponse { Id = id, Action = "setDesktopLyricsEnabled", Data = $"显示桌面歌词时出错: {ex.Message}" };
                }
            }
            else
            {
                desktopLyricsForm?.Hide();
            }

            return new WebMessageResponse { Id = id, Action = "setDesktopLyricsEnabled", Data = "OK" };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"设置桌面歌词状态失败: {ex.Message}");
            return new WebMessageResponse { Id = id, Action = "setDesktopLyricsEnabled", Data = $"操作失败: {ex.Message}" };
        }
    }

    private WebMessageResponse UpdateDesktopLyrics(string data, string id)
    {
        try
        {
            var payload = ReadDesktopLyricsPayload(data);
            lastDesktopLyricsPayload = payload;

            if (payload.Enabled && !isDesktopLyricsClosedByUser)
            {
                try
                {
                    var lyricsForm = EnsureDesktopLyricsForm();
                    lyricsForm.UpdateLyrics(payload);
                    lyricsForm.ShowLyrics();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"更新桌面歌词失败: {ex.Message}");
                    return new WebMessageResponse { Id = id, Action = "updateDesktopLyrics", Data = $"更新歌词时出错: {ex.Message}" };
                }
            }
            else
            {
                desktopLyricsForm?.Hide();
            }

            return new WebMessageResponse { Id = id, Action = "updateDesktopLyrics", Data = "OK" };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"更新桌面歌词状态失败: {ex.Message}");
            return new WebMessageResponse { Id = id, Action = "updateDesktopLyrics", Data = $"操作失败: {ex.Message}" };
        }
    }

    private DesktopLyricsPayload ReadDesktopLyricsPayload(string data)
    {
        if (string.IsNullOrWhiteSpace(data))
        {
            return new DesktopLyricsPayload();
        }

        try
        {
            return JsonSerializer.Deserialize<DesktopLyricsPayload>(data, jsonOptions) ?? new DesktopLyricsPayload();
        }
        catch
        {
            return new DesktopLyricsPayload();
        }
    }

    private DesktopLyricsForm EnsureDesktopLyricsForm()
    {
        if (desktopLyricsForm == null || desktopLyricsForm.IsDisposed)
        {
            desktopLyricsForm = new DesktopLyricsForm(this);
            desktopLyricsForm.CloseRequested += (_, _) =>
            {
                isDesktopLyricsClosedByUser = true;
                lastDesktopLyricsPayload.Enabled = false;
                desktopLyricsForm?.Hide();
                NotifyDesktopLyricsClosed();
            };
        }

        return desktopLyricsForm;
    }

    private void NotifyDesktopLyricsClosed()
    {
        try
        {
            var response = new WebMessageResponse { Action = "desktopLyricsClosed", Data = "OK" };
            webView.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(response));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"通知桌面歌词关闭失败: {ex.Message}");
        }
    }

    private WebMessageResponse SetImmersiveFullscreen(bool enabled, string id)
    {
        if (enabled)
        {
            EnterImmersiveFullscreen();
            return new WebMessageResponse { Id = id, Action = "enterImmersivePlayer", Data = "OK" };
        }

        ExitImmersiveFullscreen();
        return new WebMessageResponse { Id = id, Action = "exitImmersivePlayer", Data = "OK" };
    }

    private void EnterImmersiveFullscreen()
    {
        if (isImmersiveFullscreen) return;

        isImmersiveFullscreen = true;
        previousFormBorderStyle = FormBorderStyle;
        previousWindowState = WindowState;
        previousBounds = Bounds;
        previousTopMost = TopMost;

        SuspendLayout();
        WindowState = FormWindowState.Normal;
        FormBorderStyle = FormBorderStyle.None;
        TopMost = true;
        Bounds = Screen.FromControl(this).Bounds;
        ResumeLayout();
    }

    private void ExitImmersiveFullscreen()
    {
        if (!isImmersiveFullscreen) return;

        SuspendLayout();
        TopMost = previousTopMost;
        FormBorderStyle = previousFormBorderStyle;
        Bounds = previousBounds;
        WindowState = previousWindowState;
        ResumeLayout();

        isImmersiveFullscreen = false;
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
