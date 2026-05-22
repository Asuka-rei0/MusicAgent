using AAudioCore.Contracts;
using AAudioCore.Models;

namespace AAudioCore.Strategies;

public sealed class NormalStrategy : IPlaybackStrategy
{
    public string Name => "normal";

    public int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue)
    {
        if (queue.Count == 0) return -1;
        return currentIndex >= queue.Count - 1 ? 0 : currentIndex + 1;
    }
}
