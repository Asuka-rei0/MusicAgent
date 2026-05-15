import { BaseAudioService } from "./base-audio-service";
import { PlaybackStatus } from "../models/audio-state";
import { PlayCommandType, type IPlayCommand } from "../models/play-command";

export class WebAudioService extends BaseAudioService {
  private readonly audio: HTMLAudioElement;

  constructor(audioElement?: HTMLAudioElement) {
    super();
    this.audio = audioElement ?? new Audio();
    this.bindAudioEvents();
    this.updateState({
      volume: this.audio.volume,
      playbackRate: this.audio.playbackRate
    });
  }

  loadMedia(trackId: string, sourceUri: string): void {
    this.syncCurrentIndex(trackId);
    this.updateState({
      trackId,
      sourceUri,
      status: PlaybackStatus.Loading,
      currentMs: 0,
      durationMs: 0,
      errorMessage: undefined
    });

    this.audio.src = sourceUri;
    this.audio.load();
  }

  executeCommand(command: IPlayCommand): void {
    switch (command.type) {
      case PlayCommandType.Play:
        void this.audio.play().catch((error: unknown) => {
          this.updateState({
            status: PlaybackStatus.Error,
            errorMessage: getErrorMessage(error)
          });
        });
        break;
      case PlayCommandType.Pause:
        this.audio.pause();
        break;
      case PlayCommandType.Stop:
        this.audio.pause();
        this.audio.currentTime = 0;
        this.updateState({ status: PlaybackStatus.Idle, currentMs: 0 });
        break;
      case PlayCommandType.Toggle:
        if (this.audio.paused) {
          this.executeCommand({ type: PlayCommandType.Play });
        } else {
          this.executeCommand({ type: PlayCommandType.Pause });
        }
        break;
      case PlayCommandType.Next:
        this.playNext();
        break;
      case PlayCommandType.Previous:
        this.playPrevious();
        break;
      case PlayCommandType.SetVolume:
        this.audio.volume = clamp(command.volume, 0, 1);
        this.updateState({ volume: this.audio.volume });
        break;
      case PlayCommandType.SetPlaybackRate:
        this.audio.playbackRate = Math.max(0.25, command.playbackRate);
        this.updateState({ playbackRate: this.audio.playbackRate });
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
    this.audio.currentTime = Math.max(0, milliseconds) / 1000;
    this.updateState({ currentMs: this.audio.currentTime * 1000 });
  }

  dispose(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.observers.clear();
  }

  protected playLoadedMedia(): void {
    this.executeCommand({ type: PlayCommandType.Play });
  }

  private bindAudioEvents(): void {
    this.audio.addEventListener("loadedmetadata", () => {
      this.updateState({
        status: PlaybackStatus.Ready,
        durationMs: Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0
      });
    });

    this.audio.addEventListener("play", () => {
      this.updateState({ status: PlaybackStatus.Playing });
    });

    this.audio.addEventListener("pause", () => {
      if (this.state.status !== PlaybackStatus.Ended && this.state.status !== PlaybackStatus.Idle) {
        this.updateState({ status: PlaybackStatus.Paused });
      }
    });

    this.audio.addEventListener("waiting", () => {
      this.updateState({ status: PlaybackStatus.Buffering });
    });

    this.audio.addEventListener("timeupdate", () => {
      this.updateState({ currentMs: this.audio.currentTime * 1000 });
    });

    this.audio.addEventListener("ended", () => {
      if (this.playNext()) return;

      this.updateState({
        status: PlaybackStatus.Ended,
        currentMs: this.state.durationMs
      });
    });

    this.audio.addEventListener("error", () => {
      this.updateState({
        status: PlaybackStatus.Error,
        errorMessage: "Audio playback failed."
      });
    });
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Audio playback failed.";
};
