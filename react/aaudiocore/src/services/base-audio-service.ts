import type { IAudioService } from "../contracts/audio-service";
import type { IAudioStateObserver } from "../contracts/audio-state-observer";
import type { IPlaybackStrategy } from "../contracts/playback-strategy";
import type { IPlayCommand } from "../models/play-command";
import { type AudioState, createInitialAudioState } from "../models/audio-state";
import type { PlaybackTrack } from "../models/track";
import { NormalStrategy } from "../strategies/normal-strategy";

export abstract class BaseAudioService implements IAudioService {
  protected state: AudioState = createInitialAudioState();
  protected observers = new Set<IAudioStateObserver>();
  protected playbackStrategy: IPlaybackStrategy = new NormalStrategy();
  protected queue: PlaybackTrack[] = [];
  protected currentIndex = -1;

  getState(): AudioState {
    return { ...this.state };
  }

  getQueue(): PlaybackTrack[] {
    return [...this.queue];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  abstract loadMedia(trackId: string, sourceUri: string): void;
  abstract executeCommand(command: IPlayCommand): void;
  abstract seekToPosition(milliseconds: number): void;
  abstract dispose(): void;

  setQueue(queue: PlaybackTrack[], startIndex = 0): void {
    this.queue = [...queue];

    if (this.queue.length === 0) {
      this.currentIndex = -1;
      this.updateState({
        trackId: null,
        sourceUri: null,
        currentMs: 0,
        durationMs: 0
      });
      return;
    }

    this.loadTrackAt(clampIndex(startIndex, this.queue.length));
  }

  playNext(): boolean {
    const nextIndex = this.playbackStrategy.selectNext(this.currentIndex, this.queue);
    return this.loadTrackAt(nextIndex, true);
  }

  playPrevious(): boolean {
    if (this.queue.length === 0) return false;
    const previousIndex = this.currentIndex <= 0 ? this.queue.length - 1 : this.currentIndex - 1;
    return this.loadTrackAt(previousIndex, true);
  }

  setPlaybackStrategy(strategy: IPlaybackStrategy): void {
    this.playbackStrategy = strategy;
  }

  attachObserver(observer: IAudioStateObserver): void {
    this.observers.add(observer);
    observer.onAudioStateChanged(this.getState());
  }

  detachObserver(observer: IAudioStateObserver): void {
    this.observers.delete(observer);
  }

  protected updateState(patch: Partial<AudioState>): void {
    this.state = { ...this.state, ...patch };
    this.notifyObservers();
  }

  protected syncCurrentIndex(trackId: string): void {
    const index = this.queue.findIndex((track) => track.id === trackId);
    this.currentIndex = index;
  }

  protected loadTrackAt(index: number, autoplay = false): boolean {
    if (index < 0 || index >= this.queue.length) return false;

    const track = this.queue[index];
    this.currentIndex = index;
    this.loadMedia(track.id, track.sourceUri);

    if (autoplay) {
      this.playLoadedMedia();
    }

    return true;
  }

  protected abstract playLoadedMedia(): void;

  protected notifyObservers(): void {
    const snapshot = this.getState();
    this.observers.forEach((observer) => observer.onAudioStateChanged(snapshot));
  }
}

const clampIndex = (index: number, length: number): number =>
  Math.min(length - 1, Math.max(0, index));
