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
                ColorFollowAlbum = true
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
            var settings = JsonSerializer.Deserialize<AppSettings>(data);
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
                var seconds = history
                    .Where(item => item.ListenedAt.Date == date.Date)
                    .Sum(item => item.DurationSeconds);

                return new WeeklyListeningData
                {
                    Day = date.ToString("ddd"),
                    Hours = Math.Round(seconds / 3600.0, 2)
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
                Name = group.Key,
                Value = Math.Round(group.Sum(item => item.DurationSeconds) / 3600.0, 2),
                Color = GetPlatformColor(group.Key)
            })
            .Where(item => item.Value > 0)
            .ToList();

        return new WebMessageResponse { Action = "getPlatformData", Data = JsonSerializer.Serialize(data) };
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

    private static string GetPlatformColor(string platform)
    {
        return platform.ToLowerInvariant() switch
        {
            "spotify" => "#F97316",
            "netease" => "#D33A31",
            "apple music" => "#EAB308",
            "qq music" => "#22C55E",
            _ => "#8B5CF6"
        };
    }
}

public class MusicDbContext : DbContext
{
    public MusicDbContext(DbContextOptions<MusicDbContext> options) : base(options) { }

    public DbSet<AppSettings> Settings { get; set; }
    public DbSet<ListeningHistory> ListeningHistory { get; set; }
}

public class WeeklyListeningData
{
    public string Day { get; set; } = string.Empty;
    public double Hours { get; set; }
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
}

public class AppSettings
{
    [Key]
    public int Id { get; set; }
    public string Theme { get; set; } = "dark";
    public bool AutoPlay { get; set; } = true;
    public bool DesktopLyrics { get; set; } = false;
    public bool ColorFollowAlbum { get; set; } = true;
    public string LastTrackPath { get; set; } = string.Empty;
    public double LastPlaybackTime { get; set; }
}

