namespace AAudioCore.Models;

public sealed record AudioState
{
    public string? TrackId { get; init; }
    public string? SourceUri { get; init; }
    public PlaybackStatus Status { get; init; } = PlaybackStatus.Idle;
    public double CurrentMs { get; init; }
    public double DurationMs { get; init; }
    public float Volume { get; init; } = 1f;
    public float PlaybackRate { get; init; } = 1f;
    public string? ErrorMessage { get; init; }
}
