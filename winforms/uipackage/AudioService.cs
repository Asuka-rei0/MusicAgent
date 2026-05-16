using AAudioCore.Models;
using AAudioCore.Services;
using System.Text.Json;

namespace MusicAgentWinForms;

public class AudioService
{
    private readonly NAudioAudioService audioCore = new();
    private string? currentFilePath;

    public WebMessageResponse Play(string data)
    {
        try
        {
            var request = JsonSerializer.Deserialize<PlayRequest>(data);
            if (request == null || string.IsNullOrEmpty(request.FilePath))
            {
                return new WebMessageResponse { Action = "play", Data = "Invalid file path" };
            }

            if (!File.Exists(request.FilePath))
            {
                return new WebMessageResponse { Action = "play", Data = "File not found" };
            }

            currentFilePath = request.FilePath;
            audioCore.LoadMedia(request.FilePath, request.FilePath);
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Play));
            var state = audioCore.GetState();

            return new WebMessageResponse
            {
                Action = "play",
                Data = JsonSerializer.Serialize(ToProgressPayload(state))
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "play", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse Pause()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Pause));
            return new WebMessageResponse
            {
                Action = "pause",
                Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "pause", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse Resume()
    {
        try
        {
            audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Play));
            return new WebMessageResponse
            {
                Action = "resume",
                Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "resume", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse Stop()
    {
        audioCore.ExecuteCommand(PlayCommand.Create(PlayCommandType.Stop));
        currentFilePath = null;
        return new WebMessageResponse
        {
            Action = "stop",
            Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
        };
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

                return new WebMessageResponse
                {
                    Action = "setVolume",
                    Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
                };
            }
            return new WebMessageResponse { Action = "setVolume", Data = "Invalid volume value" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "setVolume", Data = $"Error: {ex.Message}" };
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
                return new WebMessageResponse
                {
                    Action = "setProgress",
                    Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
                };
            }
            return new WebMessageResponse { Action = "setProgress", Data = "Invalid progress" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "setProgress", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse GetProgress()
    {
        try
        {
            audioCore.RefreshState();
            return new WebMessageResponse
            {
                Action = "getProgress",
                Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
            };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "getProgress", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse GetState()
    {
        audioCore.RefreshState();
        return new WebMessageResponse
        {
            Action = "getAudioState",
            Data = JsonSerializer.Serialize(ToProgressPayload(audioCore.GetState()))
        };
    }

    private object ToProgressPayload(AudioState state)
    {
        var progress = state.DurationMs > 0 ? state.CurrentMs / state.DurationMs * 100 : 0;

        return new
        {
            filePath = currentFilePath,
            trackId = state.TrackId,
            sourceUri = state.SourceUri,
            status = state.Status.ToString(),
            progress,
            currentTime = state.CurrentMs / 1000,
            duration = state.DurationMs / 1000,
            volume = Math.Round(state.Volume * 100),
            isPlaying = state.Status == PlaybackStatus.Playing,
            errorMessage = state.ErrorMessage
        };
    }
}

public class PlayRequest
{
    public string FilePath { get; set; } = string.Empty;
}
