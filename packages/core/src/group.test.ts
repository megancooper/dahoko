import { describe, expect, it } from "vitest";
import { dueBucket, groupByDueBucket, groupByTag, groupByStatus } from "./group";
import type { Task } from "./types";

const NOW = new Date(2026, 6, 25, 10, 0, 0); // 2026-07-25

let n = 0;
function task(overrides: Partial<Task>): Task {
  n += 1;
  return {
    id: `t${n}`,
    title: `Task ${n}`,
    notes: "",
    dueAt: null,
    hasDueTime: false,
    priority: 0,
    listId: null,
    statusId: "backlog",
    tags: [],
    completedAt: null,
    sortOrder: n,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("dueBucket", () => {
  it("buckets by due date relative to now", () => {
    expect(dueBucket(task({ dueAt: "2026-07-24" }), NOW)).toBe("overdue");
    expect(dueBucket(task({ dueAt: "2026-07-25" }), NOW)).toBe("today");
    expect(dueBucket(task({ dueAt: "2026-07-28" }), NOW)).toBe("upcoming");
    expect(dueBucket(task({}), NOW)).toBe("someday");
    expect(
      dueBucket(task({ dueAt: "2026-07-24", completedAt: "2026-07-24T12:00:00Z" }), NOW),
    ).toBe("done");
  });
});

describe("groupByDueBucket", () => {
  it("orders buckets and drops empty ones", () => {
    const groups = groupByDueBucket(
      [task({ dueAt: "2026-07-28" }), task({ dueAt: "2026-07-24" })],
      NOW,
    );
    expect([...groups.keys()]).toEqual(["overdue", "upcoming"]);
  });
});

describe("groupByTag", () => {
  it("puts multi-tag tasks in every group and untagged last", () => {
    const a = task({ tags: ["work", "home"] });
    const b = task({});
    const groups = groupByTag([a, b]);
    expect([...groups.keys()]).toEqual(["home", "work", "untagged"]);
    expect(groups.get("home")).toContain(a);
    expect(groups.get("work")).toContain(a);
    expect(groups.get("untagged")).toEqual([b]);
  });
});

describe("groupByStatus", () => {
  it("keeps declared column order and sorts by sortOrder", () => {
    const a = task({ statusId: "doing", sortOrder: 2 });
    const b = task({ statusId: "doing", sortOrder: 1 });
    const groups = groupByStatus([a, b], ["backlog", "doing", "done"]);
    expect([...groups.keys()]).toEqual(["backlog", "doing", "done"]);
    expect(groups.get("doing")).toEqual([b, a]);
  });
});
