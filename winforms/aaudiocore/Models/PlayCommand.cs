using AAudioCore.Contracts;

namespace AAudioCore.Models;

public enum PlayCommandType
{
    Play,
    Pause,
    Stop,
    Toggle,
    Next,
    Previous,
    SetVolume,
    SetPlaybackRate,
    SetPlaybackStrategy,
    SetQueue
}

public sealed record PlayCommand
{
    public PlayCommandType Type { get; init; }
    public float Volume { get; init; }
    public float PlaybackRate { get; init; }
    public IReadOnlyList<PlaybackTrack>? Queue { get; init; }
    public int StartIndex { get; init; }
    public IPlaybackStrategy? Strategy { get; init; }

    public static PlayCommand Create(PlayCommandType type) => new() { Type = type };
}
