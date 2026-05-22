using AAudioCore.Models;
using AAudioCore.Services;
using AAudioCore.Strategies;
using System.Text.Json;

namespace MusicAgentWinForms;

public class AudioService
{
    private readonly NAudioAudioService audioCore = new();
    private readonly JsonSerializerOptions jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private string playbackStrategy = "normal";
    private string? currentFilePath;

    public WebMessageResponse Play(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<PlayRequest>(data, jsonOptions);
            if (request == null || string.IsNullOrEmpty(request.FilePath))
            {
                return CreateStateResponse("play", "Invalid file path.");
            }

            if (!File.Exists(request.FilePath))
            {
                return CreateStateResponse("play", "File not found.");
            }

            currentFilePath = request.FilePath;

            if (audioCore.GetQueue().Count == 0)
            {
                audioCore.SetQueue(new[]
                {
                    new PlaybackTrack
                    {
                        Id = request.FilePath,
                        SourceUri = request.FilePath,
                        Title = Path.GetFileNameWithoutExtension(request.FilePath),
                        Artist = "Local file"
                    }
                });
            }
            else if (audioCore.GetState().SourceUri != request.FilePath)
            {
                audioCore.LoadMedia(request.FilePath, request.FilePath);
            }

            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Play));
            return CreateStateResponse("play");
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
        currentFilePath = null;
        return CreateStateResponse("stop");
    }

    public WebMessageResponse Next()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Next));
            currentFilePath = audioCore.GetState().SourceUri;
            return CreateStateResponse("next");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("next", ex.Message);
        }
    }

    public WebMessageResponse Previous()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Previous));
            currentFilePath = audioCore.GetState().SourceUri;
            return CreateStateResponse("previous");
        }
        catch (Exception ex)
        {
            return CreateStateResponse("previous", ex.Message);
        }
    }

    public WebMessageResponse SetQueue(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<SetQueueRequest>(data, jsonOptions);
            var tracks = request?.Tracks?
                .Where(track => !string.IsNullOrWhiteSpace(track.SourceUri) && File.Exists(track.SourceUri))
                .Select((track, index) => new PlaybackTrack
                {
                    Id = string.IsNullOrWhiteSpace(track.Id) ? track.SourceUri : track.Id,
                    SourceUri = track.SourceUri,
                    Title = track.Title,
                    Artist = track.Artist,
                    DurationMs = track.DurationMs
                })
                .ToList() ?? new List<PlaybackTrack>();

            if (tracks.Count == 0)
            {
                return CreateStateResponse("setQueue", "No playable local files in the queue.");
            }

            var startIndex = Math.Clamp(request?.StartIndex ?? 0, 0, tracks.Count - 1);
            audioCore.ExecuteCommand(new PlayCommand
            {
                Type = PlayCommandType.SetQueue,
                Queue = tracks,
                StartIndex = startIndex
            });

            currentFilePath = audioCore.GetState().SourceUri;
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
            currentFilePath = audioCore.GetState().SourceUri;
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
        currentFilePath = audioCore.GetState().SourceUri;
        return CreateStateResponse("getAudioState");
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

        return new
        {
            filePath = state.SourceUri ?? currentFilePath,
            trackId = state.TrackId,
            sourceUri = state.SourceUri,
            title = currentTrack?.Title,
            artist = currentTrack?.Artist,
            status = state.Status.ToString(),
            progress,
            currentTime = state.CurrentMs / 1000,
            duration = state.DurationMs / 1000,
            volume = Math.Round(state.Volume * 100),
            isPlaying = state.Status == PlaybackStatus.Playing,
            currentIndex = audioCore.GetCurrentIndex(),
            queueCount = queue.Count,
            playbackStrategy,
            errorMessage = errorMessage ?? state.ErrorMessage
        };
    }
}

public class PlayRequest
{
    public string FilePath { get; set; } = string.Empty;
}

public class SetQueueRequest
{
    public List<QueueTrackRequest> Tracks { get; set; } = new();
    public int StartIndex { get; set; }
}

public class QueueTrackRequest
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string SourceUri { get; set; } = string.Empty;
    public double? DurationMs { get; set; }
}

public class PlaybackStrategyRequest
{
    public string Strategy { get; set; } = "normal";
}
