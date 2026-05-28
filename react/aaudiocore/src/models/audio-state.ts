export enum PlaybackStatus {
  Idle = "idle",
  Loading = "loading",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Buffering = "buffering",
  Ended = "ended",
  Error = "error"
}

export interface AudioState {
  trackId: string | null;
  sourceUri: string | null;
  status: PlaybackStatus;
  currentMs: number;
  durationMs: number;
  volume: number;
  playbackRate: number;
  errorMessage?: string;
}

export const createInitialAudioState = (): AudioState => ({
  trackId: null,
  sourceUri: null,
  status: PlaybackStatus.Idle,
  currentMs: 0,
  durationMs: 0,
  volume: 1,
  playbackRate: 1
});
