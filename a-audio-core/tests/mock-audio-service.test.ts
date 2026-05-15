import { describe, expect, it } from "vitest";
import { MockAudioService, PlaybackStatus, PlayCommandType, RepeatStrategy } from "../src";

describe("MockAudioService", () => {
  it("loads media and reports ready state", () => {
    const service = new MockAudioService();

    service.loadMedia("track-1", "/demo.mp3");

    expect(service.getState()).toMatchObject({
      trackId: "track-1",
      sourceUri: "/demo.mp3",
      status: PlaybackStatus.Ready,
      currentMs: 0
    });

    service.dispose();
  });

  it("updates volume through commands", () => {
    const service = new MockAudioService();

    service.executeCommand({ type: PlayCommandType.SetVolume, volume: 2 });

    expect(service.getState().volume).toBe(1);

    service.dispose();
  });

  it("sets a queue and moves to the next track through commands", () => {
    const service = new MockAudioService();

    service.executeCommand({
      type: PlayCommandType.SetQueue,
      queue: [
        { id: "track-1", sourceUri: "/one.mp3" },
        { id: "track-2", sourceUri: "/two.mp3" }
      ]
    });

    service.executeCommand({ type: PlayCommandType.Next });

    expect(service.getCurrentIndex()).toBe(1);
    expect(service.getState()).toMatchObject({
      trackId: "track-2",
      sourceUri: "/two.mp3",
      status: PlaybackStatus.Playing
    });

    service.dispose();
  });

  it("can switch playback strategy through commands", () => {
    const service = new MockAudioService();

    service.executeCommand({
      type: PlayCommandType.SetQueue,
      queue: [
        { id: "track-1", sourceUri: "/one.mp3" },
        { id: "track-2", sourceUri: "/two.mp3" }
      ]
    });
    service.executeCommand({
      type: PlayCommandType.SetPlaybackStrategy,
      strategy: new RepeatStrategy()
    });
    service.executeCommand({ type: PlayCommandType.Next });

    expect(service.getCurrentIndex()).toBe(0);
    expect(service.getState().trackId).toBe("track-1");

    service.dispose();
  });
});
