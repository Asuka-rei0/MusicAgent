import type { IAudioStateObserver } from "./audio-state-observer";
import type { IPlaybackStrategy } from "./playback-strategy";
import type { IPlayCommand } from "../models/play-command";
import type { AudioState } from "../models/audio-state";
import type { PlaybackTrack } from "../models/track";

export interface IAudioService {
  getState(): AudioState;
  getQueue(): PlaybackTrack[];
  getCurrentIndex(): number;
  loadMedia(trackId: string, sourceUri: string): void;
  executeCommand(command: IPlayCommand): void;
  seekToPosition(milliseconds: number): void;
  setQueue(queue: PlaybackTrack[], startIndex?: number): void;
  playNext(): boolean;
  playPrevious(): boolean;
  setPlaybackStrategy(strategy: IPlaybackStrategy): void;
  attachObserver(observer: IAudioStateObserver): void;
  detachObserver(observer: IAudioStateObserver): void;
  dispose(): void;
}
