using AAudioCore.Models;

namespace AAudioCore.Contracts;

public interface IAudioStateObserver
{
    void OnAudioStateChanged(AudioState state);
}
