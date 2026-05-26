using AAudioCore.Models;
using AAudioCore.Services;
using AAudioCore.Strategies;
using System.Text.Json;

namespace MusicAgentWinForms;

public class AudioService
{
    private readonly NAudioAudioService audioCore = new();
    private readonly NeteaseService? neteaseService;
    private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly List<QueuedTrackInfo> queueManifest = new();
    private string playbackStrategy = "normal";
    private int manifestIndex = -1;
    private string? currentLogicalSource;
    private string? currentCoverUrl;

    public AudioService(NeteaseService? neteaseService = null)
    {
        this.neteaseService = neteaseService;
    }

    public async Task<WebMessageResponse> PlayAsync(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<PlayRequest>(data, jsonOptions);
            if (request == null || string.IsNullOrWhiteSpace(request.FilePath))
            {
                return CreateStateResponse("play", "Invalid file path.");
            }

            if (queueManifest.Count > 0)
            {
                var index = queueManifest.FindIndex(track =>
                    track.SourceUri.Equals(request.FilePath, StringComparison.OrdinalIgnoreCase));
                if (index < 0)
                {
                    index = manifestIndex >= 0 ? manifestIndex : 0;
                }

                return await PlayManifestAtAsync(index, "play");
            }

            return await PlaySingleAsync(
                request.FilePath,
                request.Title,
                request.Artist,
                request.CoverUrl,
                "play");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("play", ex.Message);
        }
    }

    public WebMessageResponse Pause()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Pause));
            return CreateStateResponse("pause");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("pause", ex.Message);
        }
    }

    public WebMessageResponse Resume()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Play));
            return CreateStateResponse("resume");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("resume", ex.Message);
        }
    }

    public WebMessageResponse Stop()
    {
        audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Stop));
        queueManifest.Clear();
        manifestIndex = -1;
        currentLogicalSource = null;
        currentCoverUrl = null;
        return CreateStateResponse("stop");
    }

    public async Task<WebMessageResponse> NextAsync()
    {
        try
        {
            if (queueManifest.Count == 0)
            {
                audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Next));
                SyncFromAudioCore();
                return CreateStateResponse("next");
            }

            var nextIndex = playbackStrategy switch
            {
                "shuffle" => new Random().Next(queueManifest.Count),
                "repeat" => manifestIndex,
                _ => (manifestIndex + 1) % queueManifest.Count
            };

            return await PlayManifestAtAsync(nextIndex, "next");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("next", ex.Message);
        }
    }

    public async Task<WebMessageResponse> PreviousAsync()
    {
        try
        {
            if (queueManifest.Count == 0)
            {
                audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Previous));
                SyncFromAudioCore();
                return CreateStateResponse("previous");
            }

            var previousIndex = manifestIndex <= 0 ? queueManifest.Count - 1 : manifestIndex - 1;
            return await PlayManifestAtAsync(previousIndex, "previous");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("previous", ex.Message);
        }
    }

    public async Task<WebMessageResponse> SetQueueAsync(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<SetQueueRequest>(data, jsonOptions);
            queueManifest.Clear();

            foreach (var track in request?.Tracks ?? [])
            {
                if (string.IsNullOrWhiteSpace(track.SourceUri)) continue;

                queueManifest.Add(new QueuedTrackInfo
                {
                    Id = string.IsNullOrWhiteSpace(track.Id) ? track.SourceUri : track.Id,
                    SourceUri = track.SourceUri,
                    Title = track.Title,
                    Artist = track.Artist,
                    CoverUrl = track.CoverUrl ?? "",
                    DurationMs = track.DurationMs
                });
            }

            if (queueManifest.Count == 0)
            {
                return CreateStateResponse("setQueue", "No playable tracks in the queue.");
            }

            var startIndex = Math.Clamp(request?.StartIndex ?? 0, 0, queueManifest.Count - 1);
            if (request?.AutoPlay == true)
            {
                return await PlayManifestAtAsync(startIndex, "setQueue");
            }

            manifestIndex = startIndex;
            return CreateStateResponse("setQueue");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("setQueue", ex.Message);
        }
    }

    public WebMessageResponse SetPlaybackStrategy(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<PlaybackStrategyRequest>(data, jsonOptions);
            playbackStrategy = (request?.Strategy ?? data ?? "normal").Trim().Trim('"').ToLowerInvariant();

            audioCore.ExecuteCommand(new PlayCommand
            {
                Type = PlayCommandType.SetPlaybackStrategy,
                Strategy = playbackStrategy switch
                {
                    "shuffle" => new ShuffleStrategy(),
                    "repeat" => new RepeatStrategy(),
                    _ => new NormalStrategy()
                }
            });

            if (playbackStrategy is not ("shuffle" or "repeat"))
            {
                playbackStrategy = "normal";
            }

            return CreateStateResponse("setPlaybackStrategy");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("setPlaybackStrategy", ex.Message);
        }
    }

    public WebMessageResponse SetVolume(string data)
    {
        try
        {
            if (float.TryParse(data, out float volume))
            {
                audioCore.ExecuteCommand(new PlayCommand
                {
                    Type = PlayCommandType.SetVolume,
                    Volume = Math.Clamp(volume / 100f, 0f, 1f)
                });

                return CreateStateResponse("setVolume");
            }
            return CreateStateResponse("setVolume", "Invalid volume value.");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("setVolume", ex.Message);
        }
    }

    public WebMessageResponse SetProgress(string data)
    {
        try
        {
            var state = audioCore.GetState();
            if (state.DurationMs > 0 && double.TryParse(data, out double percent))
            {
                var newPositionMs = state.DurationMs * (Math.Clamp(percent, 0, 100) / 100.0);
                audioCore.SeekToPosition(newPositionMs);
                return CreateStateResponse("setProgress");
            }
            return CreateStateResponse("setProgress", "Invalid progress.");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("setProgress", ex.Message);
        }
    }

    public WebMessageResponse GetProgress()
    {
        try
        {
            audioCore.RefreshState();
            SyncFromAudioCore();
            return CreateStateResponse("getProgress");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("getProgress", ex.Message);
        }
    }

    public WebMessageResponse GetState()
    {
        audioCore.RefreshState();
        SyncFromAudioCore();
        return CreateStateResponse("getAudioState");
    }

    private async Task<WebMessageResponse> PlayManifestAtAsync(int index, string action)
    {
        if (index < 0 || index >= queueManifest.Count)
        {
            return CreateStateResponse(action, "Track index out of range.");
        }

        var track = queueManifest[index];
        return await PlaySingleAsync(
            track.SourceUri,
            track.Title,
            track.Artist,
            track.CoverUrl,
            action,
            manifestIndex: index);
    }

    private async Task<WebMessageResponse> PlaySingleAsync(
        string sourceUri,
        string title,
        string artist,
        string? coverUrl,
        string action,
        int? manifestIndex = null)
    {
        var resolvedPath = await ResolveSourceAsync(sourceUri);
        if (string.IsNullOrWhiteSpace(resolvedPath) || !File.Exists(resolvedPath))
        {
            return CreateStateResponse(action, "File not found or unable to resolve stream.");
        }

        if (manifestIndex.HasValue)
        {
            this.manifestIndex = manifestIndex.Value;
        }
        else
        {
            queueManifest.Clear();
            this.manifestIndex = -1;
        }

        currentLogicalSource = sourceUri;
        currentCoverUrl = coverUrl ?? "";

        NeteaseTrackMetadata? neteaseMetadata = null;
        if (neteaseService != null && NeteaseService.TryParseNeteaseSource(sourceUri, out var songId))
        {
            neteaseMetadata = neteaseService.GetCachedTrackMetadata(songId);
            if (string.IsNullOrWhiteSpace(currentCoverUrl))
            {
                currentCoverUrl = neteaseMetadata?.CoverUrl ?? "";
            }
        }

        var displayTitle = string.IsNullOrWhiteSpace(title)
            ? (!string.IsNullOrWhiteSpace(neteaseMetadata?.Title)
                ? neteaseMetadata.Title
                : Path.GetFileNameWithoutExtension(resolvedPath))
            : title;
        var displayArtist = string.IsNullOrWhiteSpace(artist)
            ? (!string.IsNullOrWhiteSpace(neteaseMetadata?.Artist) ? neteaseMetadata.Artist : "Unknown Artist")
            : artist;
        var displayDurationMs = manifestIndex.HasValue
            ? queueManifest[manifestIndex.Value].DurationMs
            : (neteaseMetadata?.DurationMs > 0 ? neteaseMetadata.DurationMs : null);

        audioCore.SetQueue(new[]
        {
            new PlaybackTrack
            {
                Id = sourceUri,
                SourceUri = resolvedPath,
                Title = displayTitle,
                Artist = displayArtist,
                DurationMs = displayDurationMs
            }
        });

        audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Play));
        return CreateStateResponse(action);
    }

    private void SyncFromAudioCore()
    {
        var state = audioCore.GetState();
        if (!string.IsNullOrWhiteSpace(state.SourceUri))
        {
            currentLogicalSource = state.TrackId ?? currentLogicalSource;
        }
    }

    private async Task<string> ResolveSourceAsync(string source)
    {
        if (File.Exists(source))
        {
            return source;
        }

        if (neteaseService != null && NeteaseService.TryParseNeteaseSource(source, out var songId))
        {
            return await neteaseService.ResolveSongToLocalPathAsync(songId);
        }

        return source;
    }

    private WebMessageResponse CreateStateResponse(string action, string? errorMessage = null)
    {
        return new WebMessageResponse
        {
            Action = action,
            Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState(), errorMessage))
        };
    }

    private object ToProgressPayload(AudioState state, string? errorMessage = null)
    {
        var progress = state.DurationMs > 0 ? state.CurrentMs / state.DurationMs * 100 : 0;
        var queue = audioCore.GetQueue();
        var currentTrack = queue.FirstOrDefault(track => track.Id == state.TrackId)
            ?? queue.FirstOrDefault(track => track.SourceUri == state.SourceUri);

        var manifestTrack = manifestIndex >= 0 && manifestIndex < queueManifest.Count
            ? queueManifest[manifestIndex]
            : null;

        return new
        {
            filePath = state.SourceUri,
            logicalSourceUri = currentLogicalSource ?? manifestTrack?.SourceUri ?? state.TrackId,
            trackId = currentLogicalSource ?? state.TrackId,
            sourceUri = currentLogicalSource ?? state.SourceUri,
            title = manifestTrack?.Title ?? currentTrack?.Title,
            artist = manifestTrack?.Artist ?? currentTrack?.Artist,
            coverUrl = !string.IsNullOrWhiteSpace(currentCoverUrl) ? currentCoverUrl : manifestTrack?.CoverUrl,
            status = state.Status.ToString(),
            progress,
            currentTime = state.CurrentMs / 1000,
            duration = state.DurationMs / 1000,
            volume = Math.Round(state.Volume * 100),
            isPlaying = state.Status == PlaybackStatus.Playing,
            currentIndex = manifestIndex >= 0 ? manifestIndex : audioCore.GetCurrentIndex(),
            queueCount = queueManifest.Count > 0 ? queueManifest.Count : queue.Count,
            playbackStrategy,
            errorMessage = errorMessage ?? state.ErrorMessage
        };
    }

    private sealed class QueuedTrackInfo
    {
        public string Id { get; init; } = string.Empty;
        public string SourceUri { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Artist { get; init; } = string.Empty;
        public string CoverUrl { get; init; } = string.Empty;
        public double? DurationMs { get; init; }
    }
}

public class PlayRequest
{
    public string FilePath { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string CoverUrl { get; set; } = string.Empty;
}

public class SetQueueRequest
{
    public List<QueueTrackRequest> Tracks { get; set; } = new();
    public int StartIndex { get; set; }
    public bool AutoPlay { get; set; }
}

public class QueueTrackRequest
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string SourceUri { get; set; } = string.Empty;
    public string CoverUrl { get; set; } = string.Empty;
    public double? DurationMs { get; set; }
}

public class PlaybackStrategyRequest
{
    public string Strategy { get; set; } = "normal";
}
