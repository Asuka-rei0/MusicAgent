using System.Text.Json;
using System.Text.RegularExpressions;

namespace MusicAgentWinForms;

public class FileService
{
    private readonly string _configPath;
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
            var request = JsonSerializer.Deserialize<ScanRequest>(data);
            if (request == null || string.IsNullOrEmpty(request.Path) || !Directory.Exists(request.Path))
            {
                return new WebMessageResponse { Action = "scanFolder", Data = "Invalid folder path" };
            }

            var musicFiles = ScanForMusicFiles(request.Path);
            var entry = _localPaths.FirstOrDefault(p => p.Path == request.Path);
            if (entry != null)
            {
                entry.TrackCount = musicFiles.Count;
            }
            else
            {
                _localPaths.Add(new LocalPathEntry
                {
                    Id = DateTime.Now.Ticks.ToString(),
                    Path = request.Path,
                    TrackCount = musicFiles.Count
                });
            }
            SaveLocalPaths();

            return new WebMessageResponse
            {
                Action = "scanFolder",
                Data = JsonSerializer.Serialize(new { files = musicFiles, count = musicFiles.Count })
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
            var request = JsonSerializer.Deserialize<LocalPathEntry>(data);
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
                _localPaths.Remove(entry);
                SaveLocalPaths();
                return new WebMessageResponse { Action = "removeLocalPath", Data = "Removed" };
            }
            return new WebMessageResponse { Action = "removeLocalPath", Data = "Path not found" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "removeLocalPath", Data = $"Error: {ex.Message}" };
        }
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

    private List<LocalPathEntry> LoadLocalPaths()
    {
        if (File.Exists(_configPath))
        {
            var json = File.ReadAllText(_configPath);
            return JsonSerializer.Deserialize<List<LocalPathEntry>>(json) ?? new List<LocalPathEntry>();
        }
        return new List<LocalPathEntry>
        {
            new LocalPathEntry { Id = "1", Path = @"C:\Users\Music", TrackCount = 1245 },
            new LocalPathEntry { Id = "2", Path = @"D:\Downloads\Music", TrackCount = 367 }
        };
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
