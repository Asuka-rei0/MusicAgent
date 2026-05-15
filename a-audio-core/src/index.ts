export type { IAudioService } from "./contracts/audio-service";
export type { IAudioStateObserver } from "./contracts/audio-state-observer";
export type { IPlaybackStrategy } from "./contracts/playback-strategy";

export { PlaybackStatus, type AudioState } from "./models/audio-state";
export { PlayCommandType, type IPlayCommand } from "./models/play-command";
export type { PlaybackTrack } from "./models/track";

export { NormalStrategy } from "./strategies/normal-strategy";
export { RepeatStrategy } from "./strategies/repeat-strategy";
export { ShuffleStrategy } from "./strategies/shuffle-strategy";

export { MockAudioService } from "./services/mock-audio-service";
export { WebAudioService } from "./services/web-audio-service";
