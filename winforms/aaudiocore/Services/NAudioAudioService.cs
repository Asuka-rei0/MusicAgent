using AAudioCore.Models;
using NAudio.Wave;

namespace AAudioCore.Services;

public sealed class NAudioAudioService : BaseAudioService
{
    private IWavePlayer? waveOut;
    private AudioFileReader? audioFile;
    private bool shouldAutoplay;

    public override void LoadMedia(string trackId, string sourceUri)
    {
        StopInternal(resetState: false);
        SyncCurrentIndex(trackId);
        shouldAutoplay = false;

        UpdateState(state => state with
        {
            TrackId = trackId,
            SourceUri = sourceUri,
            Status = PlaybackStatus.Loading,
            CurrentMs = 0,
            DurationMs = 0,
            ErrorMessage = null
        });

        if (!File.Exists(sourceUri))
        {
            UpdateState(state => state with
            {
                Status = PlaybackStatus.Error,
                ErrorMessage = "File not found."
            });
            return;
        }

        try
        {
            audioFile = new AudioFileReader(sourceUri)
            {
                Volume = GetState().Volume
            };

            waveOut = new WaveOutEvent();
            waveOut.PlaybackStopped += OnPlaybackStopped;
            waveOut.Init(audioFile);

            UpdateState(state => state with
            {
                Status = PlaybackStatus.Ready,
                DurationMs = audioFile.TotalTime.TotalMilliseconds
            });
        }
        catch (Exception ex)
        {
            StopInternal(resetState: false);
            UpdateState(state => state with
            {
                Status = PlaybackStatus.Error,
                ErrorMessage = ex.Message
            });
        }
    }

    public override void ExecuteCommand(PlayCommand command)
    {
        switch (command.Type)
        {
            case PlayCommandType.Play:
                PlayAudio();
                break;
            case PlayCommandType.Pause:
                shouldAutoplay = false;
                waveOut?.Pause();
                UpdateStateFromReader(PlaybackStatus.Paused);
                break;
            case PlayCommandType.Stop:
                shouldAutoplay = false;
                StopInternal(resetState: true);
                break;
            case PlayCommandType.Toggle:
                ExecuteCommand(PlayCommand.Create(GetState().Status == PlaybackStatus.Playing
                    ? PlayCommandType.Pause
                    : PlayCommandType.Play));
                break;
            case PlayCommandType.Next:
                PlayNext();
                break;
            case PlayCommandType.Previous:
                PlayPrevious();
                break;
            case PlayCommandType.SetVolume:
                SetVolume(command.Volume);
                break;
            case PlayCommandType.SetPlaybackRate:
                UpdateState(state => state with { PlaybackRate = Math.Max(0.25f, command.PlaybackRate) });
                break;
            case PlayCommandType.SetPlaybackStrategy when command.Strategy != null:
                SetPlaybackStrategy(command.Strategy);
                break;
            case PlayCommandType.SetQueue when command.Queue != null:
                SetQueue(command.Queue, command.StartIndex);
                break;
        }
    }

    public override void SeekToPosition(double milliseconds)
    {
        if (audioFile == null) return;

        var nextMs = Math.Max(0, Math.Min(milliseconds, audioFile.TotalTime.TotalMilliseconds));
        audioFile.CurrentTime = TimeSpan.FromMilliseconds(nextMs);
        UpdateStateFromReader(GetState().Status);
    }

    public void RefreshState()
    {
        UpdateStateFromReader(GetState().Status);
    }

    public override void Dispose()
    {
        StopInternal(resetState: true);
    }

    protected override void PlayLoadedMedia()
    {
        PlayAudio();
    }

    private void PlayAudio()
    {
        shouldAutoplay = true;

        if (waveOut == null)
        {
            UpdateState(state => state with
            {
                Status = PlaybackStatus.Error,
                ErrorMessage = "No audio loaded."
            });
            return;
        }

        waveOut.Play();
        UpdateStateFromReader(PlaybackStatus.Playing);
    }

    private void SetVolume(float volume)
    {
        var nextVolume = Math.Max(0f, Math.Min(1f, volume));
        if (audioFile != null)
        {
            audioFile.Volume = nextVolume;
        }

        UpdateState(state => state with { Volume = nextVolume });
    }

    private void UpdateStateFromReader(PlaybackStatus fallbackStatus)
    {
        if (audioFile == null)
        {
            UpdateState(state => state with { Status = fallbackStatus });
            return;
        }

        var isAtEnd = IsAudioAtEnd();
        var status = waveOut?.PlaybackState switch
        {
            PlaybackState.Playing => PlaybackStatus.Playing,
            PlaybackState.Paused => PlaybackStatus.Paused,
            PlaybackState.Stopped when isAtEnd => PlaybackStatus.Ended,
            _ => fallbackStatus
        };

        UpdateState(state => state with
        {
            Status = status,
            CurrentMs = audioFile.CurrentTime.TotalMilliseconds,
            DurationMs = audioFile.TotalTime.TotalMilliseconds
        });
    }

    private void StopInternal(bool resetState)
    {
        if (waveOut != null)
        {
            waveOut.PlaybackStopped -= OnPlaybackStopped;
            waveOut.Stop();
            waveOut.Dispose();
            waveOut = null;
        }

        audioFile?.Dispose();
        audioFile = null;

        if (resetState)
        {
            UpdateState(state => state with
            {
                Status = PlaybackStatus.Idle,
                CurrentMs = 0,
                DurationMs = 0,
                ErrorMessage = null
            });
        }
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        if (e.Exception != null)
        {
            UpdateState(state => state with
            {
                Status = PlaybackStatus.Error,
                ErrorMessage = e.Exception.Message
            });
            return;
        }

        if (audioFile != null && IsAudioAtEnd())
        {
            if (shouldAutoplay && QueueCount > 1 && PlayNext()) return;
            UpdateStateFromReader(PlaybackStatus.Ended);
        }
    }

    private bool IsAudioAtEnd()
    {
        if (audioFile == null) return false;

        const double EndToleranceMs = 500;
        var remainingMs = (audioFile.TotalTime - audioFile.CurrentTime).TotalMilliseconds;
        return remainingMs <= EndToleranceMs || audioFile.Position >= audioFile.Length;
    }
}
