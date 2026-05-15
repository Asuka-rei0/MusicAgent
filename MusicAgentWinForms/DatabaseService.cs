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
        SeedData();
    }

    private void SeedData()
    {
        if (!_context.Playlists.Any())
        {
            _context.Playlists.AddRange(
                new Playlist { Name = "Jazz Favorites", Tracks = 45, Duration = "3h 12m", Cover = "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop" },
                new Playlist { Name = "Morning Vibes", Tracks = 32, Duration = "2h 45m", Cover = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop" },
                new Playlist { Name = "Workout Mix", Tracks = 58, Duration = "4h 20m", Cover = "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop" },
                new Playlist { Name = "Chill Beats", Tracks = 67, Duration = "5h 05m", Cover = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop" },
                new Playlist { Name = "Classic Hits", Tracks = 89, Duration = "6h 30m", Cover = "https://images.unsplash.com/photo-1514525253193-7a097e3d9b0f?w=200&h=200&fit=crop" }
            );
        }

        if (!_context.Tracks.Any())
        {
            _context.Tracks.AddRange(
                new Track { Title = "Midnight Jazz", Artist = "Smooth Jazz Ensemble", Album = "Late Night Sessions", Duration = "6:30", PlaylistId = 1 },
                new Track { Title = "Blue Notes", Artist = "Jazz Trio", Album = "Classic Jazz Vol. 2", Duration = "5:45", PlaylistId = 1 },
                new Track { Title = "Autumn Leaves", Artist = "Piano Masters", Album = "Season Collection", Duration = "4:20", PlaylistId = 1 },
                new Track { Title = "Sax in the City", Artist = "Urban Jazz Band", Album = "City Lights", Duration = "7:15", PlaylistId = 1 },
                new Track { Title = "Smooth Groove", Artist = "The Jazz Players", Album = "Essential Jazz", Duration = "5:30", PlaylistId = 1 }
            );
        }

        if (!_context.WeeklyData.Any())
        {
            _context.WeeklyData.AddRange(
                new WeeklyData { Day = "Mon", Hours = 3.2 },
                new WeeklyData { Day = "Tue", Hours = 4.1 },
                new WeeklyData { Day = "Wed", Hours = 2.8 },
                new WeeklyData { Day = "Thu", Hours = 5.2 },
                new WeeklyData { Day = "Fri", Hours = 6.8 },
                new WeeklyData { Day = "Sat", Hours = 8.5 },
                new WeeklyData { Day = "Sun", Hours = 7.2 }
            );
        }

        if (!_context.PlatformData.Any())
        {
            _context.PlatformData.AddRange(
                new PlatformData { Name = "Spotify", Value = 18, Color = "#1DB954" },
                new PlatformData { Name = "NetEase", Value = 12, Color = "#D33A31" },
                new PlatformData { Name = "Apple Music", Value = 8, Color = "#FA243C" },
                new PlatformData { Name = "YouTube", Value = 4, Color = "#FF0000" }
            );
        }

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

    public WebMessageResponse GetPlaylists()
    {
        var playlists = _context.Playlists.ToList();
        return new WebMessageResponse { Action = "getPlaylists", Data = JsonSerializer.Serialize(playlists) };
    }

    public WebMessageResponse GetTracks(string data)
    {
        if (int.TryParse(data, out int playlistId))
        {
            var tracks = _context.Tracks.Where(t => t.PlaylistId == playlistId).ToList();
            return new WebMessageResponse { Action = "getTracks", Data = JsonSerializer.Serialize(tracks) };
        }
        return new WebMessageResponse { Action = "getTracks", Data = "Invalid playlist ID" };
    }

    public WebMessageResponse SavePlaylist(string data)
    {
        try
        {
            var playlist = JsonSerializer.Deserialize<Playlist>(data);
            if (playlist != null)
            {
                _context.Playlists.Update(playlist);
                _context.SaveChanges();
                return new WebMessageResponse { Action = "savePlaylist", Data = "Saved" };
            }
            return new WebMessageResponse { Action = "savePlaylist", Data = "Invalid data" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "savePlaylist", Data = $"Error: {ex.Message}" };
        }
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

    public WebMessageResponse GetWeeklyData()
    {
        var data = _context.WeeklyData.ToList();
        return new WebMessageResponse { Action = "getWeeklyData", Data = JsonSerializer.Serialize(data) };
    }

    public WebMessageResponse GetPlatformData()
    {
        var data = _context.PlatformData.ToList();
        return new WebMessageResponse { Action = "getPlatformData", Data = JsonSerializer.Serialize(data) };
    }
}

public class MusicDbContext : DbContext
{
    public MusicDbContext(DbContextOptions<MusicDbContext> options) : base(options) { }

    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<Track> Tracks { get; set; }
    public DbSet<WeeklyData> WeeklyData { get; set; }
    public DbSet<PlatformData> PlatformData { get; set; }
    public DbSet<AppSettings> Settings { get; set; }
    public DbSet<LocalPath> LocalPaths { get; set; }
}

public class Playlist
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Tracks { get; set; }
    public string Duration { get; set; } = string.Empty;
    public string Cover { get; set; } = string.Empty;
}

public class Track
{
    [Key]
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string Album { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public int PlaylistId { get; set; }
}

public class WeeklyData
{
    [Key]
    public int Id { get; set; }
    public string Day { get; set; } = string.Empty;
    public double Hours { get; set; }
}

public class PlatformData
{
    [Key]
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Value { get; set; }
    public string Color { get; set; } = string.Empty;
}

public class AppSettings
{
    [Key]
    public int Id { get; set; }
    public string Theme { get; set; } = "dark";
    public bool AutoPlay { get; set; } = true;
    public bool DesktopLyrics { get; set; } = false;
    public bool ColorFollowAlbum { get; set; } = true;
}

public class LocalPath
{
    [Key]
    public int Id { get; set; }
    public string Path { get; set; } = string.Empty;
    public int TrackCount { get; set; }
}
