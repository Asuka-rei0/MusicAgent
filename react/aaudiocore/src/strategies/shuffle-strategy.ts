import type { IPlaybackStrategy } from "../contracts/playback-strategy";
import type { PlaybackTrack } from "../models/track";

export class ShuffleStrategy implements IPlaybackStrategy {
  readonly name = "shuffle";

  selectNext(currentIndex: number, queue: PlaybackTrack[]): number {
    if (queue.length === 0) return -1;
    if (queue.length === 1) return 0;

    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }

    return nextIndex;
  }
}
