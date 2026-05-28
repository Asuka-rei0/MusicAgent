import { BaseAudioService } from "./base-audio-service";
import { PlaybackStatus } from "../models/audio-state";
import { PlayCommandType, type IPlayCommand } from "../models/play-command";

export class MockAudioService extends BaseAudioService {
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly tickMs: number;

  constructor(durationMs = 180000, tickMs = 1000) {
    super();
    this.tickMs = tickMs;
    this.updateState({ durationMs });
  }

  loadMedia(trackId: string, sourceUri: string): void {
    this.syncCurrentIndex(trackId);
    this.stopTimer();
    this.updateState({
      trackId,
      sourceUri,
      status: PlaybackStatus.Ready,
      currentMs: 0,
      errorMessage: undefined
    });
  }

  executeCommand(command: IPlayCommand): void {
    switch (command.type) {
      case PlayCommandType.Play:
        this.play();
        break;
      case PlayCommandType.Pause:
        this.pause();
        break;
      case PlayCommandType.Stop:
        this.stop();
        break;
      case PlayCommandType.Toggle:
        this.state.status === PlaybackStatus.Playing ? this.pause() : this.play();
        break;
      case PlayCommandType.Next:
        this.playNext();
        break;
      case PlayCommandType.Previous:
        this.playPrevious();
        break;
      case PlayCommandType.SetVolume:
        this.updateState({ volume: clamp(command.volume, 0, 1) });
        break;
      case PlayCommandType.SetPlaybackRate:
        this.updateState({ playbackRate: Math.max(0.25, command.playbackRate) });
        break;
      case PlayCommandType.SetPlaybackStrategy:
        this.setPlaybackStrategy(command.strategy);
        break;
      case PlayCommandType.SetQueue:
        this.setQueue(command.queue, command.startIndex);
        break;
    }
  }

  seekToPosition(milliseconds: number): void {
    this.updateState({
      currentMs: clamp(milliseconds, 0, this.state.durationMs),
      status: this.state.trackId ? this.state.status : PlaybackStatus.Idle
    });
  }

  dispose(): void {
    this.stopTimer();
    this.observers.clear();
  }

  protected playLoadedMedia(): void {
    this.play();
  }

  private play(): void {
    if (!this.state.trackId) {
      this.updateState({
        status: PlaybackStatus.Error,
        errorMessage: "No media has been loaded."
      });
      return;
    }

    this.updateState({ status: PlaybackStatus.Playing, errorMessage: undefined });
    this.startTimer();
  }

  private pause(): void {
    this.stopTimer();
    this.updateState({ status: PlaybackStatus.Paused });
  }

  private stop(): void {
    this.stopTimer();
    this.updateState({ status: PlaybackStatus.Idle, currentMs: 0 });
  }

  private startTimer(): void {
    if (this.tickTimer) return;

    this.tickTimer = setInterval(() => {
      const nextMs = this.state.currentMs + this.tickMs * this.state.playbackRate;

      if (nextMs >= this.state.durationMs) {
        this.stopTimer();
        if (this.playNext()) return;

        this.updateState({
          currentMs: this.state.durationMs,
          status: PlaybackStatus.Ended
        });
        return;
      }

      this.updateState({ currentMs: nextMs });
    }, this.tickMs);
  }

  private stopTimer(): void {
    if (!this.tickTimer) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
