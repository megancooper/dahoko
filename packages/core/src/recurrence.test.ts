import { describe, expect, it } from "vitest";
import { isScheduledOn, nextOccurrence } from "./recurrence";

describe("nextOccurrence", () => {
  it("advances daily by one day", () => {
    expect(nextOccurrence("2026-07-26", "daily")).toBe("2026-07-27");
  });

  it("advances daily across a month boundary", () => {
    expect(nextOccurrence("2026-07-31", "daily")).toBe("2026-08-01");
  });

  it("skips weekends for weekdays cadence", () => {
    // 2026-07-24 is a Friday
    expect(nextOccurrence("2026-07-24", "weekdays")).toBe("2026-07-27");
    // Mid-week just advances a day
    expect(nextOccurrence("2026-07-27", "weekdays")).toBe("2026-07-28");
  });

  it("advances weekly by seven days", () => {
    expect(nextOccurrence("2026-07-26", "weekly")).toBe("2026-08-02");
  });

  it("advances monthly keeping the day of month", () => {
    expect(nextOccurrence("2026-07-15", "monthly")).toBe("2026-08-15");
  });

  it("clamps monthly to the shorter month", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
  });
});

describe("isScheduledOn", () => {
  it("daily is scheduled every day", () => {
    expect(isScheduledOn("2026-07-26", "daily", "2026-07-01")).toBe(true);
  });

  it("weekdays only Monday through Friday", () => {
    expect(isScheduledOn("2026-07-26", "weekdays", "2026-07-25")).toBe(false); // Sat
    expect(isScheduledOn("2026-07-26", "weekdays", "2026-07-26")).toBe(false); // Sun
    expect(isScheduledOn("2026-07-26", "weekdays", "2026-07-27")).toBe(true); // Mon
  });

  it("weekly matches the anchor weekday", () => {
    // 2026-07-26 is a Sunday
    expect(isScheduledOn("2026-07-26", "weekly", "2026-08-02")).toBe(true);
    expect(isScheduledOn("2026-07-26", "weekly", "2026-08-03")).toBe(false);
  });

  it("monthly matches the anchor day of month", () => {
    expect(isScheduledOn("2026-07-15", "monthly", "2026-09-15")).toBe(true);
    expect(isScheduledOn("2026-07-15", "monthly", "2026-09-16")).toBe(false);
  });
});
