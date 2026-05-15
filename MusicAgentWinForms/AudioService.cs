using NAudio.Wave;
using System.Text.Json;

namespace MusicAgentWinForms;

public class AudioService
{
    private IWavePlayer? waveOut;
    private AudioFileReader? audioFile;
    private string? currentFilePath;
    private System.Threading.Timer? progressTimer;
    private float currentVolume = 0.7f;

    public WebMessageResponse Play(string data)
    {
        try
        {
            StopInternal();

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
            audioFile = new AudioFileReader(request.FilePath);
            audioFile.Volume = currentVolume;

            waveOut = new WaveOutEvent();
            waveOut.PlaybackStopped += OnPlaybackStopped;
            waveOut.Init(audioFile);
            waveOut.Play();

            StartProgressTimer();

            return new WebMessageResponse
            {
                Action = "play",
                Data = JsonSerializer.Serialize(new { duration = audioFile.TotalTime.TotalSeconds })
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
            waveOut?.Pause();
            progressTimer?.Dispose();
            progressTimer = null;
            return new WebMessageResponse { Action = "pause", Data = "Paused" };
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
            waveOut?.Play();
            StartProgressTimer();
            return new WebMessageResponse { Action = "resume", Data = "Resumed" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "resume", Data = $"Error: {ex.Message}" };
        }
    }

    public WebMessageResponse Stop()
    {
        StopInternal();
        return new WebMessageResponse { Action = "stop", Data = "Stopped" };
    }

    public WebMessageResponse SetVolume(string data)
    {
        try
        {
            if (float.TryParse(data, out float volume))
            {
                currentVolume = Math.Clamp(volume / 100f, 0f, 1f);
                if (audioFile != null)
                {
                    audioFile.Volume = currentVolume;
                }
                return new WebMessageResponse { Action = "setVolume", Data = currentVolume.ToString() };
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
            if (audioFile != null && double.TryParse(data, out double percent))
            {
                var newPosition = TimeSpan.FromSeconds(audioFile.TotalTime.TotalSeconds * (percent / 100.0));
                audioFile.CurrentTime = newPosition;
                return new WebMessageResponse
                {
                    Action = "setProgress",
                    Data = JsonSerializer.Serialize(new { currentTime = newPosition.TotalSeconds })
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
            if (audioFile != null)
            {
                var progress = audioFile.TotalTime.TotalSeconds > 0
                    ? (audioFile.CurrentTime.TotalSeconds / audioFile.TotalTime.TotalSeconds) * 100
                    : 0;
                return new WebMessageResponse
                {
                    Action = "getProgress",
                    Data = JsonSerializer.Serialize(new
                    {
                        progress = progress,
                        currentTime = audioFile.CurrentTime.TotalSeconds,
                        duration = audioFile.TotalTime.TotalSeconds,
                        isPlaying = waveOut?.PlaybackState == PlaybackState.Playing
                    })
                };
            }
            return new WebMessageResponse { Action = "getProgress", Data = "No audio loaded" };
        }
        catch (Exception ex)
        {
            return new WebMessageResponse { Action = "getProgress", Data = $"Error: {ex.Message}" };
        }
    }

    private void StopInternal()
    {
        progressTimer?.Dispose();
        progressTimer = null;

        waveOut?.Stop();
        waveOut?.Dispose();
        waveOut = null;

        audioFile?.Dispose();
        audioFile = null;

        currentFilePath = null;
    }

    private void StartProgressTimer()
    {
        progressTimer?.Dispose();
        progressTimer = new System.Threading.Timer(state =>
        {
            if (audioFile != null && waveOut?.PlaybackState == PlaybackState.Playing)
            {
                var progress = audioFile.TotalTime.TotalSeconds > 0
                    ? (audioFile.CurrentTime.TotalSeconds / audioFile.TotalTime.TotalSeconds) * 100
                    : 0;
            }
        }, null, TimeSpan.Zero, TimeSpan.FromSeconds(1));
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        progressTimer?.Dispose();
        progressTimer = null;
    }
}

public class PlayRequest
{
    public string FilePath { get; set; } = string.Empty;
}
