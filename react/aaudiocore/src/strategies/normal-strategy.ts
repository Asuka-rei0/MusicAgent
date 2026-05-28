import type { IPlaybackStrategy } from "../contracts/playback-strategy";
import type { PlaybackTrack } from "../models/track";

export class NormalStrategy implements IPlaybackStrategy {
  readonly name = "normal";

  selectNext(currentIndex: number, queue: PlaybackTrack[]): number {
    if (queue.length === 0) return -1;
    return currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;
  }
}
