using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace MusicAgentWinForms;

public class DatabaseService
{
    private readonly MusicDbContext _context;

    public DatabaseService()
    {
        var dbPath = Path.Combine(Application.StartupPath, "musicagent.db");
        var options = new DbContextOptionsBuilder<MusicDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        _context = new MusicDbContext(options);
        _context.Database.EnsureCreated();
        EnsureSettingsColumns();
        EnsureListeningHistoryTable();
        DeleteOldListeningHistory();
        EnsureSettings();
    }

    private void EnsureSettingsColumns()
    {
        var columns = _context.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Settings')")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!columns.Contains(nameof(AppSettings.LastTrackPath)))
        {
            _context.Database.ExecuteSqlRaw("ALTER TABLE Settings ADD COLUMN LastTrackPath TEXT NOT NULL DEFAULT ''");
        }

        if (!columns.Contains(nameof(AppSettings.LastPlaybackTime)))
        {
            _context.Database.ExecuteSqlRaw("ALTER TABLE Settings ADD COLUMN LastPlaybackTime REAL NOT NULL DEFAULT 0");
        }

        if (!columns.Contains(nameof(AppSettings.LastPlaybackQueueJson)))
        {
            _context.Database.ExecuteSqlRaw("ALTER TABLE Settings ADD COLUMN LastPlaybackQueueJson TEXT NOT NULL DEFAULT ''");
        }

        if (!columns.Contains(nameof(AppSettings.LastPlaybackQueueIndex)))
        {
            _context.Database.ExecuteSqlRaw("ALTER TABLE Settings ADD COLUMN LastPlaybackQueueIndex INTEGER NOT NULL DEFAULT -1");
        }

        if (!columns.Contains(nameof(AppSettings.LastPlaybackPlaylistJson)))
        {
            _context.Database.ExecuteSqlRaw("ALTER TABLE Settings ADD COLUMN LastPlaybackPlaylistJson TEXT NOT NULL DEFAULT ''");
        }
    }

    private void EnsureSettings()
    {
        if (!_context.Settings.Any())
        {
            _context.Settings.Add(new AppSettings
            {
                Theme = "dark",
                AutoPlay = true,
                DesktopLyrics = false,
                ColorFollowAlbum = false
            });
        }

        _context.SaveChanges();
    }

    private void EnsureListeningHistoryTable()
    {
        _context.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS ListeningHistory (
                Id INTEGER NOT NULL CONSTRAINT PK_ListeningHistory PRIMARY KEY AUTOINCREMENT,
                TrackPath TEXT NOT NULL,
                Platform TEXT NOT NULL,
                ListenedAt TEXT NOT NULL,
                DurationSeconds REAL NOT NULL
            );
            """);
    }

    private void DeleteOldListeningHistory()
    {
        var cutoff = DateTime.Today.AddDays(-6);
        _context.ListeningHistory
            .Where(item => item.ListenedAt < cutoff)
            .ExecuteDelete();
    }

    public WebMessageResponse GetSettings()
    {
        var settings = _context.Settings.FirstOrDefault();
        return new WebMessageResponse { Action = "getSettings", Data = JsonSerializer.Serialize(settings) };
    }

    public WebMessageResponse SaveSettings(string data)
    {
        try
        {
            var settings = JsonSerializer.Deserialize<AppSettings>(data,new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (settings != null)
            {
                var existing = _context.Settings.FirstOrDefault();
                if (existing != null)
                {
                    existing.Theme = settings.Theme;
                    existing.AutoPlay = settings.AutoPlay;
                    existing.DesktopLyrics = settings.DesktopLyrics;
                    existing.ColorFollowAlbum = settings.ColorFollowAlbum;
                    existing.LastTrackPath = settings.LastTrackPath;
                    existing.LastPlaybackTime = settings.LastPlaybackTime;
                    existing.LastPlaybackQueueJson = settings.LastPlaybackQueueJson;
                    existing.LastPlaybackQueueIndex = settings.LastPlaybackQueueIndex;
                    existing.LastPlaybackPlaylistJson = settings.LastPlaybackPlaylistJson;
                }
                else
                {
                    _context.Settings.Add(settings);
                }
                _context.SaveChanges();
                return new WebMessageResponse { Action = "saveSettings", Data = "Saved" };
            }
            return new WebMessageResponse { Action = "saveSettings", Data = "Invalid data" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "saveSettings", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse SavePlaybackState(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<PlaybackStateRequest>(data, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (request == null)
            {
                return new WebMessageResponse { Action = "savePlaybackState", Data = "Invalid playback state" };
            }

            var settings = _context.Settings.FirstOrDefault();
            if (settings == null)
            {
                settings = new AppSettings();
                _context.Settings.Add(settings);
            }

            settings.LastTrackPath = request.LastTrackPath ?? string.Empty;
            settings.LastPlaybackTime = Math.Max(0, request.LastPlaybackTime);
            settings.LastPlaybackQueueJson = request.LastPlaybackQueueJson ?? string.Empty;
            settings.LastPlaybackQueueIndex = request.LastPlaybackQueueIndex;
            settings.LastPlaybackPlaylistJson = request.LastPlaybackPlaylistJson ?? string.Empty;
            _context.SaveChanges();

            return new WebMessageResponse { Action = "savePlaybackState", Data = "Saved" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "savePlaybackState", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse GetWeeklyData()
    {
        var since = DateTime.Today.AddDays(-6);
        var history = _context.ListeningHistory
            .Where(item => item.ListenedAt >= since)
            .ToList();

        var data = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var date = since.AddDays(offset);
                var dayHistory = history.Where(item => item.ListenedAt.Date == date.Date).ToList();
                var platforms = dayHistory
                    .GroupBy(item => item.Platform)
                    .Select(group => new WeeklyPlatformSlice
                    {
                        Name = FormatPlatformDisplayName(group.Key),
                        Hours = Math.Round(group.Sum(item => item.DurationSeconds) / 3600.0, 2),
                        Color = GetPlatformColor(group.Key)
                    })
                    .Where(slice => slice.Hours > 0)
                    .OrderByDescending(slice => slice.Hours)
                    .ToList();

                return new WeeklyListeningData
                {
                    Day = date.ToString("ddd"),
                    Hours = Math.Round(dayHistory.Sum(item => item.DurationSeconds) / 3600.0, 2),
                    Platforms = platforms
                };
            })
            .ToList();

        return new WebMessageResponse { Action = "getWeeklyData", Data = JsonSerializer.Serialize(data) };
    }

    public WebMessageResponse GetPlatformData()
    {
        var data = _context.ListeningHistory
            .GroupBy(item => item.Platform)
            .Select(group => new PlatformListeningData
            {
                Name = FormatPlatformDisplayName(group.Key),
                Value = Math.Round(group.Sum(item => item.DurationSeconds) / 3600.0, 2),
                Color = GetPlatformColor(group.Key)
            })
            .Where(item => item.Value > 0)
            .ToList();

        return new WebMessageResponse { Action = "getPlatformData", Data = JsonSerializer.Serialize(data) };
    }

    public WebMessageResponse GetListeningInsights()
    {
        try
        {
            DeleteOldListeningHistory();

            var since = DateTime.Today.AddDays(-6);
            var history = _context.ListeningHistory
                .Where(item => item.ListenedAt >= since)
                .ToList();

            var totalSeconds = history.Sum(item => item.DurationSeconds);
            var platforms = history
                .GroupBy(item => item.Platform)
                .Select(group => new
                {
                    name = FormatPlatformDisplayName(group.Key),
                    rawName = group.Key,
                    durationSeconds = Math.Round(group.Sum(item => item.DurationSeconds), 1),
                    hours = Math.Round(group.Sum(item => item.DurationSeconds) / 3600.0, 2),
                    playCount = group.Count(),
                    color = GetPlatformColor(group.Key)
                })
                .OrderByDescending(item => item.durationSeconds)
                .ToList();

            var topTracks = history
                .GroupBy(item => new { item.TrackPath, item.Platform })
                .Select(group => new
                {
                    trackPath = group.Key.TrackPath,
                    platform = FormatPlatformDisplayName(group.Key.Platform),
                    rawPlatform = group.Key.Platform,
                    title = GetTrackInsightTitle(group.Key.TrackPath),
                    songId = ExtractNeteaseSongId(group.Key.TrackPath),
                    durationSeconds = Math.Round(group.Sum(item => item.DurationSeconds), 1),
                    hours = Math.Round(group.Sum(item => item.DurationSeconds) / 3600.0, 2),
                    playCount = group.Count(),
                    lastListenedAt = group.Max(item => item.ListenedAt).ToString("o")
                })
                .OrderByDescending(item => item.durationSeconds)
                .ThenByDescending(item => item.lastListenedAt)
                .Take(8)
                .ToList();

            var bucketDefinitions = new[]
            {
                new { key = "morning", label = "Morning", color = "#F59E0B" },
                new { key = "afternoon", label = "Afternoon", color = "#38BDF8" },
                new { key = "evening", label = "Evening", color = "#A855F7" },
                new { key = "night", label = "Night", color = "#6366F1" }
            };
            var timeBuckets = bucketDefinitions
                .Select(bucket =>
                {
                    var items = history.Where(item => GetTimeBucket(item.ListenedAt) == bucket.key).ToList();
                    return new
                    {
                        bucket.key,
                        bucket.label,
                        bucket.color,
                        durationSeconds = Math.Round(items.Sum(item => item.DurationSeconds), 1),
                        hours = Math.Round(items.Sum(item => item.DurationSeconds) / 3600.0, 2),
                        playCount = items.Count
                    };
                })
                .OrderByDescending(item => item.durationSeconds)
                .ToList();

            var payload = new
            {
                since = since.ToString("o"),
                totalSeconds = Math.Round(totalSeconds, 1),
                totalHours = Math.Round(totalSeconds / 3600.0, 2),
                platforms,
                topTracks,
                preferredPlatform = platforms.FirstOrDefault()?.name ?? "",
                preferredTimeBucket = timeBuckets.FirstOrDefault(item => item.durationSeconds > 0)?.label ?? "",
                timeBuckets
            };

            return new WebMessageResponse { Action = "getListeningInsights", Data = JsonSerializer.Serialize(payload) };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "getListeningInsights", Data = JsonSerializer.Serialize(new { success = false, errorMessage = ex.Message }) };
        }
    }

    public WebMessageResponse RecordListeningTime(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<ListeningTimeRequest>(data, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (request == null || string.IsNullOrWhiteSpace(request.TrackPath) || request.DurationSeconds <= 0)
            {
                return new WebMessageResponse { Action = "recordListeningTime", Data = "Invalid listening data" };
            }

            _context.ListeningHistory.Add(new ListeningHistory
            {
                TrackPath = request.TrackPath,
                Platform = string.IsNullOrWhiteSpace(request.Platform) ? "Local" : request.Platform,
                ListenedAt = DateTime.Now,
                DurationSeconds = Math.Min(request.DurationSeconds, 300)
            });
            DeleteOldListeningHistory();
            _context.SaveChanges();

            return new WebMessageResponse { Action = "recordListeningTime", Data = "Saved" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "recordListeningTime", Data = $"Error: {ex.Message}" };
        }
    }

    private static string FormatPlatformDisplayName(string platform) =>
        platform.Equals("netease", StringComparison.OrdinalIgnoreCase) ? "网易云" : platform;

    private static string GetTimeBucket(DateTime listenedAt)
    {
        var hour = listenedAt.Hour;
        if (hour is >= 5 and < 12) return "morning";
        if (hour is >= 12 and < 18) return "afternoon";
        if (hour is >= 18 and < 24) return "evening";
        return "night";
    }

    private static long ExtractNeteaseSongId(string trackPath)
    {
        if (!trackPath.StartsWith("netease:", StringComparison.OrdinalIgnoreCase)) return 0;

        var idPart = trackPath["netease:".Length..].Split(':', 2)[0];
        return long.TryParse(idPart, out var songId) ? songId : 0;
    }

    private static string GetTrackInsightTitle(string trackPath)
    {
        if (trackPath.StartsWith("netease:", StringComparison.OrdinalIgnoreCase))
        {
            var parts = trackPath.Split(':', 3);
            if (parts.Length >= 3 && !string.IsNullOrWhiteSpace(parts[2]))
            {
                return parts[2];
            }

            var songId = ExtractNeteaseSongId(trackPath);
            return songId > 0 ? $"NetEase song {songId}" : "NetEase song";
        }

        try
        {
            var fileName = Path.GetFileNameWithoutExtension(trackPath);
            return string.IsNullOrWhiteSpace(fileName) ? trackPath : fileName;
        }
        catch
        {
            return trackPath;
        }
    }

    private static string GetPlatformColor(string platform)
    {
        return platform.ToLowerInvariant() switch
        {
            "spotify" => "#F97316",
            "netease" or "netease cloud" => "#D33A31",
            "apple music" => "#EAB308",
            "qq music" => "#22C55E",
            "local" => "#8B5CF6",
            _ => "#A855F7"
        };
    }
}

public class MusicDbContext : DbContext
{
    public MusicDbContext(DbContextOptions<MusicDbContext> options) : base(options) { }

    public DbSet<AppSettings> Settings { get; set; }
    public DbSet<ListeningHistory> ListeningHistory { get; set; }
    public DbSet<NeteaseSession> NeteaseSessions { get; set; } = null!;
    public DbSet<NeteasePlaylist> NeteasePlaylists { get; set; } = null!;
    public DbSet<NeteasePlaylistTrack> NeteasePlaylistTracks { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<NeteaseSession>().HasKey(s => s.Id);
        modelBuilder.Entity<NeteasePlaylist>().HasIndex(p => p.ExternalId).IsUnique();
        modelBuilder.Entity<NeteasePlaylistTrack>().HasIndex(t => new { t.PlaylistExternalId, t.SongId }).IsUnique();
    }
}

public class WeeklyListeningData
{
    public string Day { get; set; } = string.Empty;
    public double Hours { get; set; }
    public List<WeeklyPlatformSlice> Platforms { get; set; } = new();
}

public class WeeklyPlatformSlice
{
    public string Name { get; set; } = string.Empty;
    public double Hours { get; set; }
    public string Color { get; set; } = string.Empty;
}

public class PlatformListeningData
{
    public string Name { get; set; } = string.Empty;
    public double Value { get; set; }
    public string Color { get; set; } = string.Empty;
}

public class ListeningHistory
{
    [Key]
    public int Id { get; set; }
    public string TrackPath { get; set; } = string.Empty;
    public string Platform { get; set; } = "Local";
    public DateTime ListenedAt { get; set; }
    public double DurationSeconds { get; set; }
}

public class ListeningTimeRequest
{
    public string TrackPath { get; set; } = string.Empty;
    public string Platform { get; set; } = "Local";
    public double DurationSeconds { get; set; }
}

public class PlaybackStateRequest
{
    public string LastTrackPath { get; set; } = string.Empty;
    public double LastPlaybackTime { get; set; }
    public string LastPlaybackQueueJson { get; set; } = string.Empty;
    public int LastPlaybackQueueIndex { get; set; } = -1;
    public string LastPlaybackPlaylistJson { get; set; } = string.Empty;
}

public class AppSettings
{
    [Key]
    public int Id { get; set; }
    public string Theme { get; set; } = "dark";
    public bool AutoPlay { get; set; } = true;
    public bool DesktopLyrics { get; set; } = false;
    public bool ColorFollowAlbum { get; set; } = false;
    public string LastTrackPath { get; set; } = string.Empty;
    public double LastPlaybackTime { get; set; }
    public string LastPlaybackQueueJson { get; set; } = string.Empty;
    public int LastPlaybackQueueIndex { get; set; } = -1;
    public string LastPlaybackPlaylistJson { get; set; } = string.Empty;
}

