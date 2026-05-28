using AAudioCore.Contracts;
using AAudioCore.Models;

namespace AAudioCore.Strategies;

public sealed class ShuffleStrategy : IPlaybackStrategy
{
    private readonly Random random = new();

    public string Name => "shuffle";

    public int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue)
    {
        if (queue.Count == 0) return -1;
        if (queue.Count == 1) return 0;

        var nextIndex = currentIndex;
        while (nextIndex == currentIndex)
        {
            nextIndex = random.Next(queue.Count);
        }

        return nextIndex;
    }
}
