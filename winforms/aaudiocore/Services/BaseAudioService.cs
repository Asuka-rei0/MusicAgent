using AAudioCore.Contracts;
using AAudioCore.Models;
using AAudioCore.Strategies;

namespace AAudioCore.Services;

public abstract class BaseAudioService : IAudioService
{
    private readonly HashSet<IAudioStateObserver> observers = new();
    private readonly List<PlaybackTrack> queue = new();
    private IPlaybackStrategy playbackStrategy = new NormalStrategy();
    private AudioState state = new();
    private int currentIndex = -1;

    public AudioState GetState() => state;

    public IReadOnlyList<PlaybackTrack> GetQueue() => queue.ToList();

    public int GetCurrentIndex() => currentIndex;

    public abstract void LoadMedia(string trackId, string sourceUri);

    public abstract void ExecuteCommand(PlayCommand command);

    public abstract void SeekToPosition(double milliseconds);

    public abstract void Dispose();

    public void SetQueue(IReadOnlyList<PlaybackTrack> nextQueue, int startIndex = 0)
    {
        queue.Clear();
        queue.AddRange(nextQueue);

        if (queue.Count == 0)
        {
            currentIndex = -1;
            UpdateState(state with
            {
                TrackId = null,
                SourceUri = null,
                CurrentMs = 0,
                DurationMs = 0
            });
            return;
        }

        LoadTrackAt(Math.Min(queue.Count - 1, Math.Max(0, startIndex)));
    }

    public bool PlayNext()
    {
        var nextIndex = playbackStrategy.SelectNext(currentIndex, queue);
        return LoadTrackAt(nextIndex, true);
    }

    public bool PlayPrevious()
    {
        if (queue.Count == 0) return false;
        var previousIndex = currentIndex <= 0 ? queue.Count - 1 : currentIndex - 1;
        return LoadTrackAt(previousIndex, true);
    }

    public void SetPlaybackStrategy(IPlaybackStrategy strategy)
    {
        playbackStrategy = strategy;
    }

    public void AttachObserver(IAudioStateObserver observer)
    {
        observers.Add(observer);
        observer.OnAudioStateChanged(GetState());
    }

    public void DetachObserver(IAudioStateObserver observer)
    {
        observers.Remove(observer);
    }

    protected void UpdateState(AudioState nextState)
    {
        state = nextState;
        NotifyObservers();
    }

    protected void UpdateState(Func<AudioState, AudioState> updater)
    {
        UpdateState(updater(state));
    }

    protected void SyncCurrentIndex(string trackId)
    {
        currentIndex = queue.FindIndex(track => track.Id == trackId);
    }

    protected bool LoadTrackAt(int index, bool autoplay = false)
    {
        if (index < 0 || index >= queue.Count) return false;

        var track = queue[index];
        currentIndex = index;
        LoadMedia(track.Id, track.SourceUri);

        if (autoplay)
        {
            PlayLoadedMedia();
        }

        return true;
    }

    protected abstract void PlayLoadedMedia();

    private void NotifyObservers()
    {
        foreach (var observer in observers.ToList())
        {
            observer.OnAudioStateChanged(GetState());
        }
    }
}
