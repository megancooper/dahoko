import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

// Saturday 2026-07-25, 10:00 local
const NOW = new Date(2026, 6, 25, 10, 0, 0);

describe("parseQuickAdd", () => {
  it("parses a bare title", () => {
    expect(parseQuickAdd("Buy milk", NOW)).toEqual({
      title: "Buy milk",
      tags: [],
      priority: 0,
      dueDate: null,
      dueTime: null,
      recurrence: null,
    });
  });

  it("parses tags, priority, and tomorrow", () => {
    const r = parseQuickAdd("Buy milk tomorrow #errand !p2", NOW);
    expect(r.title).toBe("Buy milk");
    expect(r.tags).toEqual(["errand"]);
    expect(r.priority).toBe(2);
    expect(r.dueDate).toBe("2026-07-26");
  });

  it("parses word priorities", () => {
    expect(parseQuickAdd("Ship it !high", NOW).priority).toBe(3);
    expect(parseQuickAdd("Ship it !low", NOW).priority).toBe(1);
    expect(parseQuickAdd("Ship it !medium", NOW).priority).toBe(2);
  });

  it("parses today with a time", () => {
    const r = parseQuickAdd("Standup today at 15:00", NOW);
    expect(r.title).toBe("Standup");
    expect(r.dueDate).toBe("2026-07-25");
    expect(r.dueTime).toBe("15:00");
  });

  it("parses weekdays as the next occurrence", () => {
    // NOW is a Saturday; monday = 2026-07-27
    expect(parseQuickAdd("Review PR monday", NOW).dueDate).toBe("2026-07-27");
    expect(parseQuickAdd("Review PR mon", NOW).dueDate).toBe("2026-07-27");
  });

  it("pushes same-day weekday to next week", () => {
    // saturday on a Saturday
    expect(parseQuickAdd("Laundry saturday", NOW).dueDate).toBe("2026-08-01");
  });

  it("parses explicit ISO dates", () => {
    expect(parseQuickAdd("Renew domain 2026-09-01", NOW).dueDate).toBe(
      "2026-09-01",
    );
  });

  it("parses multiple tags", () => {
    const r = parseQuickAdd("Plan trip #travel #family", NOW);
    expect(r.tags).toEqual(["travel", "family"]);
    expect(r.title).toBe("Plan trip");
  });

  it("keeps date-like words inside the title when not standalone", () => {
    const r = parseQuickAdd("Write monday-review notes", NOW);
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("Write monday-review notes");
  });

  it("parses 'every day' as daily anchored today", () => {
    const r = parseQuickAdd("Morning run every day", NOW);
    expect(r.title).toBe("Morning run");
    expect(r.recurrence).toBe("daily");
    expect(r.dueDate).toBe("2026-07-25");
  });

  it("parses bare cadence words", () => {
    expect(parseQuickAdd("Journal daily", NOW).recurrence).toBe("daily");
    expect(parseQuickAdd("Report weekly", NOW).recurrence).toBe("weekly");
    expect(parseQuickAdd("Pay rent monthly", NOW).recurrence).toBe("monthly");
    expect(parseQuickAdd("Standup weekdays", NOW).recurrence).toBe("weekdays");
  });

  it("anchors 'every weekday' on the next weekday from a weekend", () => {
    // NOW is a Saturday; first occurrence is Monday
    const r = parseQuickAdd("Standup every weekday", NOW);
    expect(r.recurrence).toBe("weekdays");
    expect(r.dueDate).toBe("2026-07-27");
  });

  it("parses 'every monday' as weekly anchored on Monday", () => {
    const r = parseQuickAdd("Gym every monday", NOW);
    expect(r.title).toBe("Gym");
    expect(r.recurrence).toBe("weekly");
    expect(r.dueDate).toBe("2026-07-27");
  });

  it("parses recurrence with a time", () => {
    const r = parseQuickAdd("Morning run every day at 07:00", NOW);
    expect(r.recurrence).toBe("daily");
    expect(r.dueDate).toBe("2026-07-25");
    expect(r.dueTime).toBe("07:00");
  });

  it("lets an explicit date override the recurrence anchor", () => {
    const r = parseQuickAdd("Pay rent every month 2026-08-01", NOW);
    expect(r.recurrence).toBe("monthly");
    expect(r.dueDate).toBe("2026-08-01");
  });

  it("keeps cadence-like words inside the title when not standalone", () => {
    const r = parseQuickAdd("Read the dailynews digest", NOW);
    expect(r.recurrence).toBeNull();
    expect(r.title).toBe("Read the dailynews digest");
  });
});
