import { describe, expect, it } from "vitest";
import { motionScale } from "../utils/tableAnimations";

describe("table animation settings", () => {
  it("uses full timing in normal mode", () => {
    expect(motionScale({ enabled: true, speed: "normal" })).toBe(1);
  });

  it("shortens animations in fast mode", () => {
    expect(motionScale({ enabled: true, speed: "fast" })).toBeCloseTo(0.52);
  });

  it("skips motion when disabled or instant", () => {
    expect(motionScale({ enabled: false, speed: "normal" })).toBe(0);
    expect(motionScale({ enabled: true, speed: "instant" })).toBe(0);
  });
});
