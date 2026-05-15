import { describe, expect, it } from "vitest";
import { NormalStrategy, RepeatStrategy, ShuffleStrategy, type PlaybackTrack } from "../src";

const queue: PlaybackTrack[] = [
  { id: "1", sourceUri: "/one.mp3" },
  { id: "2", sourceUri: "/two.mp3" },
  { id: "3", sourceUri: "/three.mp3" }
];

describe("playback strategies", () => {
  it("normal strategy advances until the end", () => {
    const strategy = new NormalStrategy();

    expect(strategy.selectNext(0, queue)).toBe(1);
    expect(strategy.selectNext(2, queue)).toBe(-1);
  });

  it("repeat strategy keeps the current index", () => {
    const strategy = new RepeatStrategy();

    expect(strategy.selectNext(1, queue)).toBe(1);
  });

  it("shuffle strategy returns a valid index", () => {
    const strategy = new ShuffleStrategy();
    const nextIndex = strategy.selectNext(0, queue);

    expect(nextIndex).toBeGreaterThanOrEqual(0);
    expect(nextIndex).toBeLessThan(queue.length);
  });
});
