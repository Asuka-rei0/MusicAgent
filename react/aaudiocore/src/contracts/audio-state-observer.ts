import type { AudioState } from "../models/audio-state";

export interface IAudioStateObserver {
  onAudioStateChanged(state: AudioState): void;
}
