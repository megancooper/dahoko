import { describe, expect, it } from "vitest";
import type { RepoSnapshot } from "@/db/repo";
import {
  buildLocalDocument,
  documentToSnapshot,
  mergeSyncDocuments,
  normalizeMergedDocument,
  parseSyncDocument,
} from "./document";

function snapshot(title = "First task"): RepoSnapshot {
  return {
    statuses: [
      {
        id: "status-backlog",
        name: "Backlog",
        color: "#808FA0",
        sortOrder: 0,
        isDone: false,
      },
    ],
    lists: [],
    tasks: [
      {
        id: "task-1",
        title,
        notes: "",
        dueAt: null,
        hasDueTime: false,
        priority: 0,
        listId: null,
        statusId: "status-backlog",
        tags: [],
        recurrence: null,
        completedAt: null,
        sortOrder: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    subtasks: [],
    completions: [],
  };
}

describe("encrypted sync document", () => {
  it("retains stamps for unchanged records and stamps local edits", () => {
    const initial = buildLocalDocument(
      snapshot(),
      null,
      { millis: 0, counter: 0 },
      "device-a",
      100,
    );
    const unchanged = buildLocalDocument(
      snapshot(),
      initial.document,
      initial.clock,
      "device-a",
      200,
    );
    const edited = buildLocalDocument(
      snapshot("Edited task"),
      unchanged.document,
      unchanged.clock,
      "device-a",
      300,
    );

    expect(unchanged.document.records.tasks["task-1"].stamp).toEqual(
      initial.document.records.tasks["task-1"].stamp,
    );
    expect(edited.document.records.tasks["task-1"].stamp.millis).toBe(300);
  });

  it("merges independent device changes without losing either one", () => {
    const baseline = buildLocalDocument(
      snapshot(),
      null,
      { millis: 0, counter: 0 },
      "device-a",
      100,
    );
    const left = buildLocalDocument(
      snapshot("Edited on A"),
      baseline.document,
      baseline.clock,
      "device-a",
      200,
    );
    const rightSnapshot = snapshot();
    rightSnapshot.lists.push({
      id: "list-1",
      name: "Personal",
      color: "#A3D0FF",
      sortOrder: 0,
    });
    const right = buildLocalDocument(
      rightSnapshot,
      baseline.document,
      baseline.clock,
      "device-b",
      200,
    );

    const merged = normalizeMergedDocument(
      mergeSyncDocuments(left.document, right.document),
      left.clock,
      "device-a",
      300,
    );
    const result = documentToSnapshot(merged.document);

    expect(result.tasks[0].title).toBe("Edited on A");
    expect(result.lists[0].name).toBe("Personal");
  });

  it("propagates deletions and removes orphaned child records", () => {
    const withSubtask = snapshot();
    withSubtask.subtasks.push({
      id: "subtask-1",
      taskId: "task-1",
      title: "Child",
      done: false,
      sortOrder: 1,
    });
    const baseline = buildLocalDocument(
      withSubtask,
      null,
      { millis: 0, counter: 0 },
      "device-a",
      100,
    );
    const deleted = buildLocalDocument(
      { ...withSubtask, tasks: [], subtasks: [] },
      baseline.document,
      baseline.clock,
      "device-a",
      300,
    );

    const merged = normalizeMergedDocument(
      mergeSyncDocuments(baseline.document, deleted.document),
      deleted.clock,
      "device-b",
      400,
    );
    const result = documentToSnapshot(merged.document);

    expect(result.tasks).toEqual([]);
    expect(result.subtasks).toEqual([]);
  });

  it("rejects malformed decrypted records before they reach the repository", () => {
    const state = buildLocalDocument(
      snapshot(),
      null,
      { millis: 0, counter: 0 },
      "device-a",
      100,
    );
    const malformed = structuredClone(state.document) as unknown as {
      records: { tasks: Record<string, { value: { id: string } }> };
    };
    malformed.records.tasks["task-1"].value.id = "another-id";

    expect(() => parseSyncDocument(malformed)).toThrow(
      "mismatched record ID",
    );
  });

  it("rejects prototype-polluting record identifiers", () => {
    const state = buildLocalDocument(
      snapshot(),
      null,
      { millis: 0, counter: 0 },
      "device-a",
      100,
    );
    const malicious = JSON.parse(JSON.stringify(state.document)) as {
      records: { tasks: Record<string, unknown> };
    };
    const entry = malicious.records.tasks["task-1"];
    malicious.records.tasks = JSON.parse(
      `{"__proto__":${JSON.stringify(entry)}}`,
    ) as Record<string, unknown>;

    expect(() => parseSyncDocument(malicious)).toThrow("invalid ID");
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
