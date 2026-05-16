using AAudioCore.Models;

namespace AAudioCore.Contracts;

public interface IPlaybackStrategy
{
    string Name { get; }
    int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue);
}
