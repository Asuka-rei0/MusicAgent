import type { IPlaybackStrategy } from "../contracts/playback-strategy";
import type { PlaybackTrack } from "../models/track";

export class RepeatStrategy implements IPlaybackStrategy {
  readonly name = "repeat";

  selectNext(currentIndex: number, queue: PlaybackTrack[]): number {
    if (queue.length === 0) return -1;
    return Math.max(0, Math.min(currentIndex, queue.length - 1));
  }
}
