import { describe, expect, it } from "vitest";
import { PlaybackStatus, PlayCommandType, WebAudioService } from "../src";

describe("WebAudioService", () => {
  it("marks playback as playing when play resolves without a play event", async () => {
    const playRequest = createDeferred<void>();
    const audio = new FakeAudioElement(() => playRequest.promise);
    const service = new WebAudioService(audio as unknown as HTMLAudioElement);

    service.loadMedia("track-1", "/demo.mp3");
    service.executeCommand({ type: PlayCommandType.Play });

    expect(service.getState().status).toBe(PlaybackStatus.Loading);

    playRequest.resolve();
    await playRequest.promise;
    await Promise.resolve();

    expect(service.getState().status).toBe(PlaybackStatus.Playing);

    service.dispose();
  });

  it("cancels a pending play request when pause is requested", async () => {
    const playRequest = createDeferred<void>();
    const audio = new FakeAudioElement(() => playRequest.promise);
    const service = new WebAudioService(audio as unknown as HTMLAudioElement);

    service.loadMedia("track-1", "/demo.mp3");
    service.executeCommand({ type: PlayCommandType.Play });
    service.executeCommand({ type: PlayCommandType.Pause });

    expect(audio.pauseCalls).toBe(1);

    playRequest.resolve();
    await playRequest.promise;
    await Promise.resolve();

    expect(service.getState().status).toBe(PlaybackStatus.Paused);
    expect(audio.pauseCalls).toBe(2);

    service.dispose();
  });
});

class FakeAudioElement {
  src = "";
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  duration = 180;
  paused = true;
  pauseCalls = 0;

  constructor(private readonly playHandler: () => Promise<void>) {}

  play(): Promise<void> {
    this.paused = false;
    return this.playHandler();
  }

  pause(): void {
    this.paused = true;
    this.pauseCalls += 1;
  }

  load(): void {}

  removeAttribute(attributeName: string): void {
    if (attributeName === "src") this.src = "";
  }

  addEventListener(): void {}
}

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};
