using AAudioCore.Contracts;
using AAudioCore.Models;

namespace AAudioCore.Strategies;

public sealed class RepeatStrategy : IPlaybackStrategy
{
    public string Name => "repeat";

    public int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue)
    {
        if (queue.Count == 0) return -1;
        return Math.Max(0, Math.Min(currentIndex, queue.Count - 1));
    }
}
