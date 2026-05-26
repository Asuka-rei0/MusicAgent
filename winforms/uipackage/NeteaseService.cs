using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using System.Net;
using System.Text.Json;

namespace MusicAgentWinForms;

public class NeteaseService
{
    private readonly MusicDbContext _context;
    private readonly HttpClient _http;
    private readonly CookieContainer _cookieContainer = new();
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private string? _qrUnikey;

    public NeteaseService(MusicDbContext context)
    {
        _context = context;
        var handler = new HttpClientHandler
        {
            CookieContainer = _cookieContainer,
            UseCookies = true,
            AutomaticDecompression = DecompressionMethods.All
        };
        _http = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        _http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 MusicAgent/1.0");
        EnsureTables();
        LoadStoredCookie();
    }

    public static NeteaseService Create()
    {
        var dbPath = Path.Combine(Application.StartupPath, "musicagent.db");
        var options = new DbContextOptionsBuilder<MusicDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        return new NeteaseService(new MusicDbContext(options));
    }

    private void EnsureTables()
    {
        _context.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS NeteaseSession (
                Id INTEGER NOT NULL PRIMARY KEY CHECK (Id = 1),
                Cookie TEXT NOT NULL DEFAULT '',
                UserId INTEGER NOT NULL DEFAULT 0,
                Nickname TEXT NOT NULL DEFAULT '',
                AvatarUrl TEXT NOT NULL DEFAULT '',
                ApiBaseUrl TEXT NOT NULL DEFAULT 'http://127.0.0.1:3000',
                LoggedInAt TEXT NULL,
                LastSyncAt TEXT NULL
            );
            CREATE TABLE IF NOT EXISTS NeteasePlaylist (
                Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                ExternalId INTEGER NOT NULL UNIQUE,
                Name TEXT NOT NULL DEFAULT '',
                CoverUrl TEXT NOT NULL DEFAULT '',
                TrackCount INTEGER NOT NULL DEFAULT 0,
                Description TEXT NOT NULL DEFAULT '',
                SyncedAt TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS NeteasePlaylistTrack (
                Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                PlaylistExternalId INTEGER NOT NULL,
                SongId INTEGER NOT NULL,
                Title TEXT NOT NULL DEFAULT '',
                Artist TEXT NOT NULL DEFAULT '',
                Album TEXT NOT NULL DEFAULT '',
                DurationMs INTEGER NOT NULL DEFAULT 0,
                CoverUrl TEXT NOT NULL DEFAULT '',
                UNIQUE (PlaylistExternalId, SongId)
            );
            """);

        if (!_context.NeteaseSessions.Any())
        {
            _context.NeteaseSessions.Add(new NeteaseSession
            {
                Id = 1,
                ApiBaseUrl = "http://127.0.0.1:3000"
            });
            _context.SaveChanges();
        }
    }

    private NeteaseSession Session => _context.NeteaseSessions.First(s => s.Id == 1);

    private void LoadStoredCookie()
    {
        var cookie = Session.Cookie;
        if (string.IsNullOrWhiteSpace(cookie)) return;
        ApplyCookieHeader(cookie);
    }

    private void ApplyCookieHeader(string cookieHeader)
    {
        var baseUri = new Uri(GetApiBaseUrl().TrimEnd('/') + "/");
        foreach (var part in cookieHeader.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var eq = part.IndexOf('=');
            if (eq <= 0) continue;
            var name = part[..eq].Trim();
            var value = part[(eq + 1)..].Trim();
            try
            {
                _cookieContainer.Add(baseUri, new Cookie(name, value));
            }
            catch
            {
                // ignore invalid cookie pairs
            }
        }
    }

    private string GetApiBaseUrl() => string.IsNullOrWhiteSpace(Session.ApiBaseUrl)
        ? "http://127.0.0.1:3000"
        : Session.ApiBaseUrl.TrimEnd('/');

    private async Task<JsonDocument> GetApiAsync(string path, CancellationToken cancellationToken = default)
    {
        var url = $"{GetApiBaseUrl()}{path}";
        using var response = await _http.GetAsync(url, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"网易云 API 请求失败 ({(int)response.StatusCode})：{Truncate(body, 200)}");
        }

        try
        {
            return JsonDocument.Parse(body);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"网易云 API 返回非 JSON，请确认已启动 NeteaseCloudMusicApi（{GetApiBaseUrl()}）。{ex.Message}");
        }
    }

    /// <summary>可选接口：HTTP 失败或业务 code 非 200 时返回 null（不用于扫码登录等返回 801–803 的接口）。</summary>
    private async Task<JsonDocument?> TryGetApiAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var doc = await GetApiAsync(path, cancellationToken);
            if (doc.RootElement.TryGetProperty("code", out var codeProp) &&
                codeProp.ValueKind == JsonValueKind.Number &&
                codeProp.TryGetInt32(out var code) &&
                code != 200)
            {
                doc.Dispose();
                return null;
            }

            return doc;
        }
        catch
        {
            return null;
        }
    }

    public WebMessageResponse GetStatus(string requestId = "")
    {
        var session = Session;
        return Ok(requestId, "getNeteaseStatus", new
        {
            loggedIn = !string.IsNullOrWhiteSpace(session.Cookie) && session.UserId > 0,
            userId = session.UserId,
            nickname = session.Nickname,
            avatarUrl = session.AvatarUrl,
            apiBaseUrl = session.ApiBaseUrl,
            lastSyncAt = session.LastSyncAt?.ToString("o"),
            playlistCount = _context.NeteasePlaylists.Count()
        });
    }

    public WebMessageResponse SetApiBaseUrl(string data, string requestId = "")
    {
        try
        {
            var request = JsonSerializer.Deserialize<NeteaseApiBaseUrlRequest>(data, _jsonOptions);
            var url = (request?.ApiBaseUrl ?? data ?? "").Trim().Trim('"');
            if (string.IsNullOrWhiteSpace(url))
            {
                return Error(requestId, "setNeteaseApiBaseUrl", "API 地址不能为空。");
            }

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return Error(requestId, "setNeteaseApiBaseUrl", "API 地址格式无效。");
            }

            var session = Session;
            session.ApiBaseUrl = url.TrimEnd('/');
            _context.SaveChanges();
            return GetStatus(requestId);
        }
        catch (Exception ex)
        {
            return Error(requestId, "setNeteaseApiBaseUrl", ex.Message);
        }
    }

    public async Task<WebMessageResponse> StartQrLoginAsync(string requestId = "")
    {
        try
        {
            PrepareForQrLogin();
            using var keyDoc = await GetApiAsync("/login/qr/key");
            var unikey = ReadUnikey(keyDoc.RootElement);
            if (string.IsNullOrWhiteSpace(unikey))
            {
                return Error(requestId, "neteaseQrStart", "无法获取二维码 key，请检查 API 服务是否运行。");
            }

            _qrUnikey = unikey;
            using var createDoc = await GetApiAsync($"/login/qr/create?key={Uri.EscapeDataString(unikey)}&qrimg=true");
            var qrimg = ReadQrCreateImage(createDoc.RootElement);
            if (string.IsNullOrWhiteSpace(qrimg))
            {
                return Error(requestId, "neteaseQrStart", "无法获取二维码图片，请升级 NeteaseCloudMusicApi 后重试。");
            }

            return Ok(requestId, "neteaseQrStart", new
            {
                unikey,
                qrImage = qrimg,
                message = "请使用网易云音乐 App 扫描二维码登录。"
            });
        }
        catch (Exception ex)
        {
            return Error(requestId, "neteaseQrStart", ex.Message);
        }
    }

    public async Task<WebMessageResponse> CheckQrLoginAsync(string requestId = "")
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_qrUnikey))
            {
                return Ok(requestId, "neteaseQrCheck", new { status = "expired", message = "二维码已失效，请重新获取。" });
            }

            using var doc = await GetApiAsync($"/login/qr/check?key={Uri.EscapeDataString(_qrUnikey)}&timestamp={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}");
            var root = doc.RootElement;
            var code = ReadApiCode(root);
            var message = ReadString(root, "message");
            if (string.IsNullOrWhiteSpace(message) && root.TryGetProperty("msg", out _))
            {
                message = ReadString(root, "msg");
            }

            if (code == 803)
            {
                var cookieFromResponse = ReadQrLoginCookie(root);
                if (!string.IsNullOrWhiteSpace(cookieFromResponse))
                {
                    ApplyCookieHeader(cookieFromResponse);
                }

                var cookie = BuildCookieHeader();
                if (string.IsNullOrWhiteSpace(cookie))
                {
                    cookie = cookieFromResponse;
                }

                if (string.IsNullOrWhiteSpace(cookie))
                {
                    return Error(requestId, "neteaseQrCheck", "扫码成功但未获取登录 Cookie，请重启 API 服务后重试。");
                }

                await SaveLoginAsync(cookie);

                if (Session.UserId <= 0)
                {
                    return Error(requestId, "neteaseQrCheck", "未能获取账号信息，请确认 API 服务正常后重新扫码。");
                }

                _qrUnikey = null;
                return Ok(requestId, "neteaseQrCheck", new
                {
                    status = "success",
                    message = "登录成功。",
                    profile = BuildProfilePayload()
                });
            }

            if (code == 804)
            {
                _qrUnikey = null;
                return Ok(requestId, "neteaseQrCheck", new { status = "expired", message = "二维码已过期，请重新获取。" });
            }

            var waitingMessage = code switch
            {
                801 => "等待扫码…",
                802 => "扫码成功，请在手机上确认登录…",
                _ => string.IsNullOrWhiteSpace(message) ? "等待扫码…" : message
            };

            return Ok(requestId, "neteaseQrCheck", new { status = "waiting", message = waitingMessage });
        }
        catch (Exception ex)
        {
            return Error(requestId, "neteaseQrCheck", ex.Message);
        }
    }

    public WebMessageResponse Logout(string requestId = "")
    {
        var session = Session;
        session.Cookie = "";
        session.UserId = 0;
        session.Nickname = "";
        session.AvatarUrl = "";
        session.LoggedInAt = null;
        session.LastSyncAt = null;
        _context.NeteasePlaylistTracks.ExecuteDelete();
        _context.NeteasePlaylists.ExecuteDelete();
        _context.ListeningHistory.Where(h => h.Platform == "netease").ExecuteDelete();
        _context.SaveChanges();

        ClearHttpCookies();
        _qrUnikey = null;
        return GetStatus(requestId);
    }

    public async Task<WebMessageResponse> SyncAsync(string requestId = "")
    {
        try
        {
            if (!IsLoggedIn())
            {
                return Error(requestId, "syncNetease", "请先扫码登录网易云账号。");
            }

            if (!await RefreshProfileAsync())
            {
                await ClearLoginCredentialsAsync();
                return Error(requestId, "syncNetease", "登录已失效，请重新扫码登录。");
            }

            var uid = Session.UserId;

            var playlistCount = await SyncPlaylistsAsync(uid);
            var (listeningImported, listeningWarning) = await SyncListeningDataAsync(uid);

            var session = Session;
            session.LastSyncAt = DateTime.Now;
            _context.SaveChanges();

            var message = $"已同步 {playlistCount} 个歌单，导入 {listeningImported} 条听歌记录。";
            if (!string.IsNullOrWhiteSpace(listeningWarning))
            {
                message += $"（{listeningWarning}）";
            }

            return Ok(requestId, "syncNetease", new
            {
                success = true,
                playlistCount,
                listeningImported,
                listeningWarning,
                lastSyncAt = session.LastSyncAt?.ToString("o"),
                message
            });
        }
        catch (Exception ex)
        {
            return Error(requestId, "syncNetease", ex.Message);
        }
    }

    public WebMessageResponse GetPlaylists(string requestId = "")
    {
        var playlists = _context.NeteasePlaylists
            .OrderByDescending(p => p.SyncedAt)
            .Select(p => new
            {
                externalId = p.ExternalId,
                name = p.Name,
                coverUrl = p.CoverUrl,
                trackCount = p.TrackCount,
                description = p.Description,
                syncedAt = p.SyncedAt.ToString("o")
            })
            .ToList();

        return Ok(requestId, "getNeteasePlaylists", playlists);
    }

    public async Task<WebMessageResponse> GetPlaylistTracksAsync(string data, string requestId = "")
    {
        try
        {
            var playlistId = ParsePlaylistIdFromRequest(data);
            if (playlistId <= 0)
            {
                return Error(requestId, "getNeteasePlaylistTracks", "无效的歌单 ID。");
            }

            if (!HasPlaylistTracks(playlistId))
            {
                await FetchAndStorePlaylistTracksAsync(playlistId);
            }
            else if (_context.NeteasePlaylistTracks.Any(t =>
                         t.PlaylistExternalId == playlistId &&
                         (t.CoverUrl == null || t.CoverUrl == "")))
            {
                await EnrichMissingTrackCoversAsync(playlistId);
                _context.SaveChanges();
            }

            var tracks = BuildPlaylistTrackPayload(playlistId);
            return Ok(requestId, "getNeteasePlaylistTracks", new
            {
                playlistId,
                tracks,
                message = tracks.Count == 0 ? "歌单中没有可显示的曲目。" : null
            });
        }
        catch (Exception ex)
        {
            return Error(requestId, "getNeteasePlaylistTracks", ex.Message);
        }
    }

    public async Task<string> ResolveSongToLocalPathAsync(long songId, CancellationToken cancellationToken = default)
    {
        if (songId <= 0)
        {
            throw new InvalidOperationException("无效的歌曲 ID。");
        }

        var cacheDir = Path.Combine(Application.StartupPath, "netease-cache");
        Directory.CreateDirectory(cacheDir);
        var cacheFile = Path.Combine(cacheDir, $"{songId}.mp3");

        if (File.Exists(cacheFile) && new FileInfo(cacheFile).Length > 1024)
        {
            return cacheFile;
        }

        using var doc = await GetApiAsync($"/song/url?id={songId}&br=320000", cancellationToken);
        var url = ExtractSongUrl(doc.RootElement);
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new InvalidOperationException("无法获取播放地址，可能是版权限制或未登录 VIP。");
        }

        using var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        await using var fileStream = File.Create(cacheFile);
        await stream.CopyToAsync(fileStream, cancellationToken);
        return cacheFile;
    }

    public static bool TryParseNeteaseSource(string source, out long songId)
    {
        songId = 0;
        if (string.IsNullOrWhiteSpace(source) || !source.StartsWith("netease:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var idPart = source["netease:".Length..].Split(':', 2)[0];
        return long.TryParse(idPart, out songId) && songId > 0;
    }

    private bool HasPlaylistTracks(long playlistId) =>
        _context.NeteasePlaylistTracks.Any(t => t.PlaylistExternalId == playlistId);

    private List<object> BuildPlaylistTrackPayload(long playlistId) =>
        _context.NeteasePlaylistTracks
            .Where(t => t.PlaylistExternalId == playlistId)
            .OrderBy(t => t.Id)
            .Select(t => new
            {
                id = $"netease-{t.SongId}",
                songId = t.SongId,
                title = t.Title,
                artist = t.Artist,
                album = t.Album,
                durationMs = t.DurationMs,
                duration = FormatDuration(t.DurationMs),
                coverUrl = t.CoverUrl,
                filePath = "",
                sourceUri = $"netease:{t.SongId}",
                isNetease = true
            })
            .Cast<object>()
            .ToList();

    private Task FetchAndStorePlaylistTracksAsync(long playlistId) =>
        LoadPlaylistTracksFromApiAsync(playlistId, clearExisting: true, upsertPlaylistRow: true);

    private async Task LoadPlaylistTracksFromApiAsync(long playlistId, bool clearExisting, bool upsertPlaylistRow)
    {
        using var doc = await GetApiAsync($"/playlist/detail?id={playlistId}");
        var root = doc.RootElement;
        var playlist = root.TryGetProperty("playlist", out var playlistProp) ? playlistProp : root;
        var playlistCover = ReadCover(playlist);

        var existingPlaylist = _context.NeteasePlaylists.FirstOrDefault(p => p.ExternalId == playlistId);
        if (existingPlaylist != null)
        {
            if (!string.IsNullOrWhiteSpace(playlistCover))
            {
                existingPlaylist.CoverUrl = playlistCover;
            }

            existingPlaylist.Name = ReadString(playlist, "name");
            existingPlaylist.TrackCount = (int)ReadLong(playlist, "trackCount");
            existingPlaylist.SyncedAt = DateTime.Now;
        }
        else if (upsertPlaylistRow)
        {
            _context.NeteasePlaylists.Add(new NeteasePlaylist
            {
                ExternalId = playlistId,
                Name = ReadString(playlist, "name"),
                CoverUrl = playlistCover,
                TrackCount = (int)ReadLong(playlist, "trackCount"),
                Description = ReadString(playlist, "description"),
                SyncedAt = DateTime.Now
            });
        }

        if (clearExisting)
        {
            _context.NeteasePlaylistTracks.Where(t => t.PlaylistExternalId == playlistId).ExecuteDelete();
        }

        var songIds = CollectPlaylistSongIds(playlist);
        if (songIds.Count > 0)
        {
            await StoreTracksFromSongDetailAsync(playlistId, songIds);
        }
        else if (playlist.TryGetProperty("tracks", out var tracksProp) &&
                 tracksProp.ValueKind == JsonValueKind.Array &&
                 tracksProp.GetArrayLength() > 0)
        {
            foreach (var track in tracksProp.EnumerateArray())
            {
                AddPlaylistTrackEntity(playlistId, track);
            }
        }

        await EnrichMissingTrackCoversAsync(playlistId);

        if (existingPlaylist != null && string.IsNullOrWhiteSpace(existingPlaylist.CoverUrl))
        {
            existingPlaylist.CoverUrl = _context.NeteasePlaylistTracks
                .Where(t => t.PlaylistExternalId == playlistId && t.CoverUrl != "")
                .Select(t => t.CoverUrl)
                .FirstOrDefault() ?? playlistCover;
        }

        _context.SaveChanges();
    }

    private static List<long> CollectPlaylistSongIds(JsonElement playlist)
    {
        var ids = new List<long>();
        var seen = new HashSet<long>();

        if (playlist.TryGetProperty("trackIds", out var trackIdsProp) &&
            trackIdsProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in trackIdsProp.EnumerateArray())
            {
                var id = ReadLong(item, "id");
                if (id > 0 && seen.Add(id))
                {
                    ids.Add(id);
                }
            }
        }

        if (ids.Count == 0 &&
            playlist.TryGetProperty("tracks", out var tracksProp) &&
            tracksProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var track in tracksProp.EnumerateArray())
            {
                var id = ReadLong(track, "id");
                if (id > 0 && seen.Add(id))
                {
                    ids.Add(id);
                }
            }
        }

        return ids;
    }

    private async Task StoreTracksFromSongDetailAsync(long playlistId, IReadOnlyList<long> songIds)
    {
        foreach (var batch in songIds.Take(500).Chunk(80))
        {
            var idQuery = string.Join(",", batch);
            using var trackDoc = await GetApiAsync($"/song/detail?ids={idQuery}");
            if (!trackDoc.RootElement.TryGetProperty("songs", out var songs) ||
                songs.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var track in songs.EnumerateArray())
            {
                AddPlaylistTrackEntity(playlistId, track);
            }
        }
    }

    private async Task EnrichMissingTrackCoversAsync(long playlistId)
    {
        var tracksNeedingCover = _context.NeteasePlaylistTracks
            .Where(t => t.PlaylistExternalId == playlistId && (t.CoverUrl == null || t.CoverUrl == ""))
            .ToList();

        if (tracksNeedingCover.Count == 0) return;

        foreach (var batch in tracksNeedingCover.Select(t => t.SongId).Distinct().Chunk(80))
        {
            var idQuery = string.Join(",", batch);
            using var trackDoc = await GetApiAsync($"/song/detail?ids={idQuery}");
            if (!trackDoc.RootElement.TryGetProperty("songs", out var songs) || songs.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var song in songs.EnumerateArray())
            {
                var songId = ReadLong(song, "id");
                if (songId <= 0) continue;

                var cover = ReadTrackCover(song);
                if (string.IsNullOrWhiteSpace(cover)) continue;

                foreach (var entity in tracksNeedingCover.Where(t => t.SongId == songId))
                {
                    entity.CoverUrl = cover;
                }
            }
        }
    }

    private void AddPlaylistTrackEntity(long playlistId, JsonElement track)
    {
        var songId = ReadLong(track, "id");
        if (songId <= 0) return;

        var coverUrl = ReadTrackCover(track);
        var existing = _context.NeteasePlaylistTracks
            .FirstOrDefault(t => t.PlaylistExternalId == playlistId && t.SongId == songId);

        if (existing != null)
        {
            existing.Title = ReadString(track, "name");
            existing.Artist = ReadArtists(track);
            existing.Album = ReadAlbumName(track);
            existing.DurationMs = (int)ReadLong(track, "dt");
            if (!string.IsNullOrWhiteSpace(coverUrl))
            {
                existing.CoverUrl = coverUrl;
            }

            return;
        }

        _context.NeteasePlaylistTracks.Add(new NeteasePlaylistTrack
        {
            PlaylistExternalId = playlistId,
            SongId = songId,
            Title = ReadString(track, "name"),
            Artist = ReadArtists(track),
            Album = ReadAlbumName(track),
            DurationMs = (int)ReadLong(track, "dt"),
            CoverUrl = coverUrl
        });
    }

    private static long ParsePlaylistIdFromRequest(string data)
    {
        using var doc = JsonDocument.Parse(data);
        if (!doc.RootElement.TryGetProperty("playlistId", out var prop))
        {
            return 0;
        }

        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.TryGetInt64(out var number) ? number : 0,
            JsonValueKind.String => long.TryParse(prop.GetString(), out var parsed) ? parsed : 0,
            _ => 0
        };
    }

    private static string ExtractSongUrl(JsonElement root)
    {
        if (root.TryGetProperty("data", out var data))
        {
            if (data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var url = ReadString(item, "url");
                    if (!string.IsNullOrWhiteSpace(url)) return url;
                }
            }
            else if (data.ValueKind == JsonValueKind.Object)
            {
                var url = ReadString(data, "url");
                if (!string.IsNullOrWhiteSpace(url)) return url;
            }
        }

        return "";
    }

    private bool IsLoggedIn()
    {
        var session = Session;
        return !string.IsNullOrWhiteSpace(session.Cookie) && session.UserId > 0;
    }

    private void PrepareForQrLogin()
    {
        _qrUnikey = null;
        ClearHttpCookies();
    }

    private void ClearHttpCookies()
    {
        var baseUri = new Uri(GetApiBaseUrl().TrimEnd('/') + "/");
        foreach (Cookie cookie in _cookieContainer.GetCookies(baseUri))
        {
            cookie.Expired = true;
        }
    }

    private async Task ClearLoginCredentialsAsync()
    {
        var session = Session;
        session.Cookie = "";
        session.UserId = 0;
        session.Nickname = "";
        session.AvatarUrl = "";
        session.LoggedInAt = null;
        ClearHttpCookies();
        _qrUnikey = null;
        await _context.SaveChangesAsync();
    }

    private async Task SaveLoginAsync(string cookie)
    {
        ApplyCookieHeader(cookie);
        var session = Session;
        session.Cookie = cookie;
        session.LoggedInAt = DateTime.Now;
        await _context.SaveChangesAsync();

        for (var attempt = 0; attempt < 3 && session.UserId <= 0; attempt++)
        {
            await RefreshProfileAsync();
            if (attempt < 2)
            {
                await Task.Delay(400);
            }
        }
    }

    private async Task<bool> RefreshProfileAsync()
    {
        using var doc = await GetApiAsync("/login/status");
        var root = doc.RootElement;
        var data = TryGetDataObject(root, out var dataObj) ? dataObj : root;
        var account = TryGetObjectChild(data, "account", out var accountEl) ? accountEl : default;
        var profile = TryGetObjectChild(data, "profile", out var profileEl)
            ? profileEl
            : account;

        var session = Session;
        session.UserId = ReadLong(profile, "userId");
        if (session.UserId == 0)
        {
            session.UserId = ReadLong(profile, "id");
        }
        if (session.UserId == 0)
        {
            session.UserId = ReadLong(account, "id");
        }
        if (session.UserId == 0)
        {
            session.UserId = ReadLong(account, "userId");
        }
        if (session.UserId == 0)
        {
            session.UserId = ReadLong(data, "userId");
        }

        session.Nickname = ReadString(profile, "nickname");
        if (string.IsNullOrWhiteSpace(session.Nickname))
        {
            session.Nickname = ReadString(account, "userName");
        }
        if (string.IsNullOrWhiteSpace(session.Nickname))
        {
            session.Nickname = ReadString(data, "nickname");
        }

        session.AvatarUrl = ReadString(profile, "avatarUrl");
        if (string.IsNullOrWhiteSpace(session.AvatarUrl))
        {
            session.AvatarUrl = ReadString(profile, "avatar");
        }

        if (string.IsNullOrWhiteSpace(session.Cookie))
        {
            session.Cookie = BuildCookieHeader();
        }

        await _context.SaveChangesAsync();
        return session.UserId > 0;
    }

    private async Task<int> SyncPlaylistsAsync(long uid)
    {
        _context.NeteasePlaylistTracks.ExecuteDelete();
        _context.NeteasePlaylists.ExecuteDelete();
        _context.SaveChanges();

        var synced = 0;
        var offset = 0;
        const int limit = 50;

        while (offset < 200)
        {
            using var doc = await GetApiAsync($"/user/playlist?uid={uid}&limit={limit}&offset={offset}");
            var playlistsElement = doc.RootElement.GetProperty("playlist");
            if (playlistsElement.ValueKind != JsonValueKind.Array || playlistsElement.GetArrayLength() == 0)
            {
                break;
            }

            foreach (var item in playlistsElement.EnumerateArray())
            {
                var externalId = ReadLong(item, "id");
                if (externalId <= 0) continue;

                var playlist = new NeteasePlaylist
                {
                    ExternalId = externalId,
                    Name = ReadString(item, "name"),
                    CoverUrl = ReadCover(item),
                    TrackCount = (int)ReadLong(item, "trackCount"),
                    Description = ReadString(item, "description"),
                    SyncedAt = DateTime.Now
                };
                _context.NeteasePlaylists.Add(playlist);
                synced++;

                await LoadPlaylistTracksFromApiAsync(externalId, clearExisting: false, upsertPlaylistRow: false);
            }

            _context.SaveChanges();

            if (playlistsElement.GetArrayLength() < limit)
            {
                break;
            }

            offset += limit;
        }

        return synced;
    }

    private Task SyncPlaylistTracksAsync(long playlistId) =>
        LoadPlaylistTracksFromApiAsync(playlistId, clearExisting: false, upsertPlaylistRow: false);

    private async Task<(int Imported, string? Warning)> SyncListeningDataAsync(long uid)
    {
        _context.ListeningHistory.Where(h => h.Platform == "netease").ExecuteDelete();

        var imported = 0;
        var warnings = new List<string>();

        using (var weekDoc = await TryGetApiAsync($"/user/record?uid={uid}&type=1"))
        {
            if (weekDoc != null)
            {
                imported += ImportListeningRecordItems(weekDoc.RootElement, "weekData");
            }
            else
            {
                warnings.Add("周听歌排行获取失败");
            }
        }

        using (var allDoc = await TryGetApiAsync($"/user/record?uid={uid}&type=0"))
        {
            if (allDoc != null)
            {
                imported += ImportListeningRecordItems(allDoc.RootElement, "allData", maxPerSong: 8);
            }
            else
            {
                warnings.Add("总听歌排行获取失败");
            }
        }

        _context.SaveChanges();

        string? warning = null;
        if (warnings.Count > 0)
        {
            warning = imported > 0
                ? string.Join("；", warnings) + "，部分听歌数据已导入"
                : string.Join("；", warnings) + "，不影响歌单同步";
        }

        return (imported, warning);
    }

    private int ImportListeningRecordItems(JsonElement root, string propertyName, int maxPerSong = 30)
    {
        if (!root.TryGetProperty(propertyName, out var list) || list.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        var imported = 0;
        var dayOffset = 0;
        foreach (var item in list.EnumerateArray())
        {
            var song = item.TryGetProperty("song", out var songProp) ? songProp : item;
            var songId = ReadLong(song, "id");
            if (songId <= 0) continue;

            var title = ReadString(song, "name");
            var playCount = (int)Math.Max(1, ReadLong(item, "playCount"));
            var durationSec = Math.Min(ReadLong(song, "dt") / 1000.0, 600);
            if (durationSec <= 0) durationSec = 180;

            for (var i = 0; i < Math.Min(playCount, maxPerSong); i++)
            {
                _context.ListeningHistory.Add(new ListeningHistory
                {
                    TrackPath = $"netease:{songId}:{title}",
                    Platform = "netease",
                    ListenedAt = DateTime.Today.AddDays(-(dayOffset % 7)).AddHours(-(i % 10)),
                    DurationSeconds = durationSec
                });
                imported++;
                dayOffset++;
            }
        }

        return imported;
    }

    private object BuildProfilePayload()
    {
        var session = Session;
        return new
        {
            userId = session.UserId,
            nickname = session.Nickname,
            avatarUrl = session.AvatarUrl
        };
    }

    private string BuildCookieHeader()
    {
        var baseUri = new Uri(GetApiBaseUrl().TrimEnd('/') + "/");
        return string.Join("; ", _cookieContainer.GetCookies(baseUri).Cast<Cookie>().Select(c => $"{c.Name}={c.Value}"));
    }

    private static int ReadApiCode(JsonElement root)
    {
        if (!root.TryGetProperty("code", out var codeProp)) return 0;
        return codeProp.ValueKind switch
        {
            JsonValueKind.Number => codeProp.TryGetInt32(out var code) ? code : 0,
            JsonValueKind.String => int.TryParse(codeProp.GetString(), out var parsed) ? parsed : 0,
            _ => 0
        };
    }

    private static string ReadQrLoginCookie(JsonElement root)
    {
        if (root.TryGetProperty("cookie", out var cookieProp) && cookieProp.ValueKind == JsonValueKind.String)
        {
            var direct = cookieProp.GetString();
            if (!string.IsNullOrWhiteSpace(direct)) return direct;
        }

        if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object)
        {
            var nested = ReadString(data, "cookie");
            if (!string.IsNullOrWhiteSpace(nested)) return nested;
        }

        return "";
    }

    private static bool TryGetDataObject(JsonElement root, out JsonElement data)
    {
        data = default;
        if (!root.TryGetProperty("data", out var prop) || prop.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        data = prop;
        return true;
    }

    private static bool TryGetObjectChild(JsonElement element, string name, out JsonElement child)
    {
        child = default;
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(name, out var prop) ||
            prop.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        child = prop;
        return true;
    }

    private static string ReadUnikey(JsonElement root)
    {
        if (TryGetDataObject(root, out var data))
        {
            var key = ReadString(data, "unikey");
            if (!string.IsNullOrWhiteSpace(key)) return key;
        }

        if (root.TryGetProperty("unikey", out var direct) && direct.ValueKind == JsonValueKind.String)
        {
            return direct.GetString() ?? "";
        }

        return "";
    }

    private static string ReadQrCreateImage(JsonElement root)
    {
        if (TryGetDataObject(root, out var data))
        {
            foreach (var name in new[] { "qrimg", "qrImg" })
            {
                var img = ReadString(data, name);
                if (!string.IsNullOrWhiteSpace(img)) return NormalizeQrImageDataUri(img);
            }
        }

        foreach (var name in new[] { "qrimg", "qrImg" })
        {
            var img = ReadString(root, name);
            if (!string.IsNullOrWhiteSpace(img)) return NormalizeQrImageDataUri(img);
        }

        if (root.TryGetProperty("data", out var dataProp) && dataProp.ValueKind == JsonValueKind.String)
        {
            var raw = dataProp.GetString() ?? "";
            if (!string.IsNullOrWhiteSpace(raw)) return NormalizeQrImageDataUri(raw);
        }

        return "";
    }

    private static string NormalizeQrImageDataUri(string value)
    {
        value = value.Trim();
        if (value.StartsWith("data:image", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        return "data:image/png;base64," + value;
    }

    private static long ReadLong(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop)) return 0;
        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.TryGetInt64(out var value) ? value : 0,
            JsonValueKind.String => long.TryParse(prop.GetString(), out var parsed) ? parsed : 0,
            _ => 0
        };
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop)) return "";
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() ?? "" : prop.ToString();
    }

    private static string ReadArtists(JsonElement track)
    {
        if (!track.TryGetProperty("ar", out var ar) || ar.ValueKind != JsonValueKind.Array)
        {
            return "Unknown Artist";
        }

        var names = ar.EnumerateArray()
            .Select(artist => ReadString(artist, "name"))
            .Where(name => !string.IsNullOrWhiteSpace(name));
        var joined = string.Join(" / ", names);
        return string.IsNullOrWhiteSpace(joined) ? "Unknown Artist" : joined;
    }

    private static string ReadAlbumName(JsonElement track)
    {
        if (track.TryGetProperty("al", out var al))
        {
            var name = ReadString(al, "name");
            if (!string.IsNullOrWhiteSpace(name)) return name;
        }

        return ReadString(track, "album");
    }

    private static string ReadTrackCover(JsonElement track)
    {
        foreach (var albumKey in new[] { "al", "album" })
        {
            if (!track.TryGetProperty(albumKey, out var album)) continue;

            var albumCover = ReadCoverFromElement(album);
            if (!string.IsNullOrWhiteSpace(albumCover))
            {
                return albumCover;
            }
        }

        return ReadCoverFromElement(track);
    }

    private static string ReadCover(JsonElement element) => ReadCoverFromElement(element);

    private static string ReadCoverFromElement(JsonElement element)
    {
        foreach (var propertyName in new[] { "coverImgUrl", "picUrl", "img1v1Url", "blurPicUrl", "coverUrl" })
        {
            if (!element.TryGetProperty(propertyName, out var prop)) continue;

            var url = prop.ValueKind == JsonValueKind.String ? prop.GetString() : null;
            var normalized = NormalizeCoverUrl(url);
            if (!string.IsNullOrWhiteSpace(normalized))
            {
                return normalized;
            }
        }

        return "";
    }

    private static string NormalizeCoverUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "";

        url = url.Trim();
        if (url.StartsWith("//", StringComparison.Ordinal))
        {
            url = "https:" + url;
        }

        if (url.Contains("music.126.net", StringComparison.OrdinalIgnoreCase) &&
            !url.Contains("param=", StringComparison.OrdinalIgnoreCase))
        {
            url += url.Contains('?') ? "&param=300y300" : "?param=300y300";
        }

        return url;
    }

    public async Task<WebMessageResponse> GetLyricsAsync(string sourceKey, long songId, string requestId = "")
    {
        try
        {
            using var doc = await GetApiAsync($"/lyric?id={songId}");
            var content = ExtractLyricContent(doc.RootElement);
            var found = !string.IsNullOrWhiteSpace(content);
            return Ok(requestId, "getLyrics", new
            {
                found,
                filePath = sourceKey,
                lyricPath = found ? $"netease:{songId}" : string.Empty,
                content,
                errorMessage = found ? null : "该歌曲暂无歌词。"
            });
        }
        catch (Exception ex)
        {
            return Ok(requestId, "getLyrics", new
            {
                found = false,
                filePath = sourceKey,
                lyricPath = string.Empty,
                content = string.Empty,
                errorMessage = ex.Message
            });
        }
    }

    private static string ExtractLyricContent(JsonElement root)
    {
        if (root.TryGetProperty("lrc", out var lrc) &&
            lrc.ValueKind == JsonValueKind.Object &&
            lrc.TryGetProperty("lyric", out var lyricProp))
        {
            var text = NormalizeLyricText(lyricProp.ValueKind == JsonValueKind.String ? lyricProp.GetString() : null);
            if (!string.IsNullOrWhiteSpace(text))
            {
                return text;
            }
        }

        return string.Empty;
    }

    private static string NormalizeLyricText(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

        return raw
            .Replace("\\n", "\n", StringComparison.Ordinal)
            .Replace("\\r", "\r", StringComparison.Ordinal)
            .Replace("\\t", "\t", StringComparison.Ordinal);
    }

    private static string FormatDuration(int durationMs)
    {
        if (durationMs <= 0) return "--:--";
        var totalSeconds = durationMs / 1000;
        return $"{totalSeconds / 60}:{(totalSeconds % 60):D2}";
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";

    private static WebMessageResponse Ok(string id, string action, object data) =>
        new() { Id = id, Action = action, Data = JsonSerializer.Serialize(data) };

    private static WebMessageResponse Error(string id, string action, string message) =>
        Ok(id, action, new { success = false, errorMessage = message });
}

[Table("NeteaseSession")]
public class NeteaseSession
{
    public int Id { get; set; } = 1;
    public string Cookie { get; set; } = "";
    public long UserId { get; set; }
    public string Nickname { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public string ApiBaseUrl { get; set; } = "http://127.0.0.1:3000";
    public DateTime? LoggedInAt { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

[Table("NeteasePlaylist")]
public class NeteasePlaylist
{
    public int Id { get; set; }
    public long ExternalId { get; set; }
    public string Name { get; set; } = "";
    public string CoverUrl { get; set; } = "";
    public int TrackCount { get; set; }
    public string Description { get; set; } = "";
    public DateTime SyncedAt { get; set; }
}

[Table("NeteasePlaylistTrack")]
public class NeteasePlaylistTrack
{
    public int Id { get; set; }
    public long PlaylistExternalId { get; set; }
    public long SongId { get; set; }
    public string Title { get; set; } = "";
    public string Artist { get; set; } = "";
    public string Album { get; set; } = "";
    public int DurationMs { get; set; }
    public string CoverUrl { get; set; } = "";
}

public class NeteaseApiBaseUrlRequest
{
    public string ApiBaseUrl { get; set; } = "";
}

public class NeteasePlaylistTracksRequest
{
    public long PlaylistId { get; set; }
}
