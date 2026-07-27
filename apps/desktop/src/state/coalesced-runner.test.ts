import { describe, expect, it } from "vitest";
import { createCoalescedRunner } from "./coalesced-runner";

describe("createCoalescedRunner", () => {
  it("combines requests queued before a run begins", async () => {
    let runs = 0;
    const requestRun = createCoalescedRunner(async () => {
      runs += 1;
    });

    await Promise.all([requestRun(), requestRun(), requestRun()]);

    expect(runs).toBe(1);
  });

  it("uses one trailing run for requests made during active work", async () => {
    let runs = 0;
    const releases: Array<() => void> = [];
    const requestRun = createCoalescedRunner(
      () =>
        new Promise<void>((resolve) => {
          runs += 1;
          releases.push(resolve);
        }),
    );

    const first = requestRun();
    await Promise.resolve();
    expect(runs).toBe(1);

    const trailing = Promise.all([requestRun(), requestRun()]);
    releases.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(2);

    releases.shift()?.();
    await Promise.all([first, trailing]);
    expect(runs).toBe(2);
  });

  it("recovers after a failed run", async () => {
    let shouldFail = true;
    const requestRun = createCoalescedRunner(async () => {
      if (shouldFail) throw new Error("database unavailable");
    });

    await expect(requestRun()).rejects.toThrow("database unavailable");
    shouldFail = false;
    await expect(requestRun()).resolves.toBeUndefined();
  });
});
