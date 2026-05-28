namespace AAudioCore.Models;

public enum PlaybackStatus
{
    Idle,
    Loading,
    Ready,
    Playing,
    Paused,
    Buffering,
    Ended,
    Error
}
