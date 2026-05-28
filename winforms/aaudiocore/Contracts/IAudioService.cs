using AAudioCore.Models;

namespace AAudioCore.Contracts;

public interface IAudioService : IDisposable
{
    AudioState GetState();
    IReadOnlyList<PlaybackTrack> GetQueue();
    int GetCurrentIndex();
    void LoadMedia(string trackId, string sourceUri);
    void ExecuteCommand(PlayCommand command);
    void SeekToPosition(double milliseconds);
    void SetQueue(IReadOnlyList<PlaybackTrack> queue, int startIndex = 0);
    bool PlayNext();
    bool PlayPrevious();
    void SetPlaybackStrategy(IPlaybackStrategy strategy);
    void AttachObserver(IAudioStateObserver observer);
    void DetachObserver(IAudioStateObserver observer);
}
