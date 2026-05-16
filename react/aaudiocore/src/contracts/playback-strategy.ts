import type { PlaybackTrack } from "../models/track";

export interface IPlaybackStrategy {
  readonly name: string;
  selectNext(currentIndex: number, queue: PlaybackTrack[]): number;
}
