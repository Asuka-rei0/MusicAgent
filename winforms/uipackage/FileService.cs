using System.Text.Json;
using System.Text.RegularExpressions;

namespace MusicAgentWinForms;

public class FileService
{
    private readonly string _configPath;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private List<LocalPathEntry> _localPaths;

    public FileService()
    {
        _configPath = Path.Combine(Application.StartupPath, "localpaths.json");
        _localPaths = LoadLocalPaths();
    }

    public WebMessageResponse ScanFolder(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<ScanRequest>(data, _jsonOptions);
            if (request == null || string.IsNullOrEmpty(request.Path) || !Directory.Exists(request.Path))
            {
                return new WebMessageResponse { Action = "scanFolder", Data = "Invalid folder path" };
            }

            var musicFiles = ScanForMusicFiles(request.Path);
            var tracks = musicFiles.Select(ReadTrackMetadata).ToList();
            var entry = _localPaths.FirstOrDefault(p => p.Path == request.Path);
            if (entry != null)
            {
                entry.TrackCount = tracks.Count;
            }
            else
            {
                _localPaths.Add(new LocalPathEntry
                {
                    Id = DateTime.Now.Ticks.ToString(),
                    Path = request.Path,
                    TrackCount = tracks.Count
                });
            }
            SaveLocalPaths();

            return new WebMessageResponse
            {
                Action = "scanFolder",
                Data = JsonSerializer.Serialize(new { path = request.Path, files = musicFiles, tracks, count = tracks.Count })
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "scanFolder", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse GetLocalPaths()
    {
        return new WebMessageResponse
        {
            Action = "getLocalPaths",
            Data = JsonSerializer.Serialize(_localPaths)
        };
    }

    public WebMessageResponse AddLocalPath(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<LocalPathEntry>(data, _jsonOptions);
            if (request == null || string.IsNullOrEmpty(request.Path))
            {
                return new WebMessageResponse { Action = "addLocalPath", Data = "Invalid path" };
            }

            if (!Directory.Exists(request.Path))
            {
                return new WebMessageResponse { Action = "addLocalPath", Data = "Directory not found" };
            }

            if (_localPaths.Any(p => p.Path == request.Path))
            {
                return new WebMessageResponse { Action = "addLocalPath", Data = "Path already exists" };
            }

            var musicFiles = ScanForMusicFiles(request.Path);
            request.Id = DateTime.Now.Ticks.ToString();
            request.TrackCount = musicFiles.Count;
            _localPaths.Add(request);
            SaveLocalPaths();

            return new WebMessageResponse
            {
                Action = "addLocalPath",
                Data = JsonSerializer.Serialize(request)
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "addLocalPath", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse RemoveLocalPath(string data)
    {
        try
        {
            var entry = _localPaths.FirstOrDefault(p => p.Id == data);
            if (entry != null)
            {
                var removedEntry = new LocalPathEntry
                {
                    Id = entry.Id,
                    Path = entry.Path,
                    TrackCount = entry.TrackCount
                };
                _localPaths.Remove(entry);
                SaveLocalPaths();
                return new WebMessageResponse
                {
                    Action = "removeLocalPath",
                    Data = JsonSerializer.Serialize(removedEntry)
                };
            }
            return new WebMessageResponse { Action = "removeLocalPath", Data = "Path not found" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "removeLocalPath", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse GetLyrics(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<LyricRequest>(data, _jsonOptions);
            if (request == null || string.IsNullOrWhiteSpace(request.FilePath))
            {
                return CreateLyricsResponse(false, string.Empty, string.Empty, string.Empty, "Invalid file path.");
            }

            var audioPath = request.FilePath;
            var lyricPath = Path.ChangeExtension(audioPath, ".lrc");
            if (string.IsNullOrWhiteSpace(lyricPath) || !File.Exists(lyricPath))
            {
                return CreateLyricsResponse(false, audioPath, lyricPath ?? string.Empty, string.Empty, "No matching .lrc file found.");
            }

            var content = File.ReadAllText(lyricPath);
            return CreateLyricsResponse(true, audioPath, lyricPath, content);
        }
        catch (Exception ex)
        {
            return CreateLyricsResponse(false, string.Empty, string.Empty, string.Empty, ex.Message);
        }
    }

    private static WebMessageResponse CreateLyricsResponse(bool found, string filePath, string lyricPath, string content, string? errorMessage = null)
    {
        return new WebMessageResponse
        {
            Action = "getLyrics",
            Data = JsonSerializer.Serialize(new
            {
                found,
                filePath,
                lyricPath,
                content,
                errorMessage
            })
        };
    }

    private List<string> ScanForMusicFiles(string folderPath)
    {
        var musicExtensions = new[] { ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma" };
        var files = new List<string>();

        try
        {
            foreach (var ext in musicExtensions)
            {
                files.AddRange(Directory.GetFiles(folderPath, $"*{ext}", SearchOption.TopDirectoryOnly));
            }

            foreach (var subDir in Directory.GetDirectories(folderPath))
            {
                try
                {
                    files.AddRange(ScanForMusicFiles(subDir));
                }
                catch (UnauthorizedAccessException)
                {
                    continue;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error scanning {folderPath}: {ex.Message}");
        }

        return files;
    }

    private static LocalTrackInfo ReadTrackMetadata(string filePath)
    {
        var fallbackTitle = Path.GetFileNameWithoutExtension(filePath);
        var fallbackAlbum = GetParentFolderName(filePath);

        try
        {
            using var file = TagLib.File.Create(filePath);
            var title = string.IsNullOrWhiteSpace(file.Tag.Title) ? fallbackTitle : file.Tag.Title;
            var artist = GetFirstNonEmpty(file.Tag.Performers)
                ?? GetFirstNonEmpty(file.Tag.AlbumArtists)
                ?? "Unknown Artist";
            var album = string.IsNullOrWhiteSpace(file.Tag.Album) ? fallbackAlbum : file.Tag.Album;
            var duration = file.Properties.Duration;

            return new LocalTrackInfo
            {
                Id = $"local-{filePath}",
                FilePath = filePath,
                Title = title,
                Artist = artist,
                Album = album,
                Duration = FormatDuration(duration),
                DurationMs = duration.TotalMilliseconds
            };
        }
        catch
        {
            return new LocalTrackInfo
            {
                Id = $"local-{filePath}",
                FilePath = filePath,
                Title = fallbackTitle,
                Artist = "Unknown Artist",
                Album = fallbackAlbum,
                Duration = "--:--",
                DurationMs = null
            };
        }
    }

    private static string? GetFirstNonEmpty(IEnumerable<string>? values)
    {
        return values?.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
    }

    private static string GetParentFolderName(string filePath)
    {
        return Directory.GetParent(filePath)?.Name ?? "Local Music";
    }

    private static string FormatDuration(TimeSpan duration)
    {
        if (duration <= TimeSpan.Zero) return "--:--";
        return duration.TotalHours >= 1
            ? $"{(int)duration.TotalHours}:{duration.Minutes:00}:{duration.Seconds:00}"
            : $"{(int)duration.TotalMinutes}:{duration.Seconds:00}";
    }

    private List<LocalPathEntry> LoadLocalPaths()
    {
        if (File.Exists(_configPath))
        {
            var json = File.ReadAllText(_configPath);
            return JsonSerializer.Deserialize<List<LocalPathEntry>>(json, _jsonOptions) ?? new List<LocalPathEntry>();
        }
        return new List<LocalPathEntry>();
    }

    private void SaveLocalPaths()
    {
        var json = JsonSerializer.Serialize(_localPaths, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_configPath, json);
    }
}

public class LocalPathEntry
{
    public string Id { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int TrackCount { get; set; }
}

public class ScanRequest
{
    public string Path { get; set; } = string.Empty;
}

public class LyricRequest
{
    public string FilePath { get; set; } = string.Empty;
}

public class LocalTrackInfo
{
    public string Id { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string Album { get; set; } = string.Empty;
    public string Duration { get; set; } = "--:--";
    public double? DurationMs { get; set; }
}
