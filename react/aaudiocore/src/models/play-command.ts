import type { IPlaybackStrategy } from "../contracts/playback-strategy";
import type { PlaybackTrack } from "./track";

export enum PlayCommandType {
  Play = "play",
  Pause = "pause",
  Stop = "stop",
  Toggle = "toggle",
  Next = "next",
  Previous = "previous",
  SetVolume = "setVolume",
  SetPlaybackRate = "setPlaybackRate",
  SetPlaybackStrategy = "setPlaybackStrategy",
  SetQueue = "setQueue"
}

export type IPlayCommand =
  | { type: PlayCommandType.Play }
  | { type: PlayCommandType.Pause }
  | { type: PlayCommandType.Stop }
  | { type: PlayCommandType.Toggle }
  | { type: PlayCommandType.Next }
  | { type: PlayCommandType.Previous }
  | { type: PlayCommandType.SetVolume; volume: number }
  | { type: PlayCommandType.SetPlaybackRate; playbackRate: number }
  | { type: PlayCommandType.SetPlaybackStrategy; strategy: IPlaybackStrategy }
  | { type: PlayCommandType.SetQueue; queue: PlaybackTrack[]; startIndex?: number };
