namespace AAudioCore.Models;

public sealed record PlaybackTrack
{
    public string Id { get; init; } = string.Empty;
    public string? Title { get; init; }
    public string? Artist { get; init; }
    public string SourceUri { get; init; } = string.Empty;
    public double? DurationMs { get; init; }
}
