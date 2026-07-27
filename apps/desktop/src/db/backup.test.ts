import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupValidationError,
  createBackup,
  parseBackupJson,
  validateBackup,
} from "./backup";
import type { RepoSnapshot } from "./repo";

function snapshot(): RepoSnapshot {
  return {
    statuses: [
      {
        id: "status-open",
        name: "Open",
        color: "#808FA0",
        sortOrder: 0,
        isDone: false,
      },
    ],
    lists: [
      {
        id: "list-work",
        name: "Work",
        color: "#A3D0FF",
        sortOrder: 0,
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Ship backup support",
        notes: "",
        dueAt: "2026-07-27",
        hasDueTime: false,
        priority: 2,
        listId: "list-work",
        statusId: "status-open",
        tags: ["release"],
        recurrence: null,
        completedAt: null,
        sortOrder: 0,
        createdAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
      },
    ],
    subtasks: [
      {
        id: "subtask-1",
        taskId: "task-1",
        title: "Validate files",
        done: true,
        sortOrder: 0,
      },
    ],
    completions: [],
  };
}

describe("backup validation", () => {
  it("round-trips a valid backup into sanitized data", () => {
    const backup = createBackup(snapshot());
    const parsed = parseBackupJson(JSON.stringify(backup));

    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.data.tasks[0]?.title).toBe("Ship backup support");
  });

  it("rejects unsupported backup versions", () => {
    const backup = { ...createBackup(snapshot()), version: 99 };

    expect(() => validateBackup(backup)).toThrow(
      "This backup version is not supported.",
    );
  });

  it("rejects broken relationships before any data is replaced", () => {
    const backup = createBackup(snapshot());
    backup.data.tasks[0]!.statusId = "missing";

    expect(() => validateBackup(backup)).toThrow(
      "Task 1 refers to a missing status.",
    );
  });

  it("rejects malformed JSON with a user-safe error", () => {
    expect(() => parseBackupJson("{nope")).toThrow(BackupValidationError);
    expect(() => parseBackupJson("{nope")).toThrow(
      "The selected file is not valid JSON.",
    );
  });

  it("rejects duplicate completion dates that SQLite cannot store", () => {
    const backup = createBackup(snapshot());
    const completion = {
      id: "completion-1",
      taskId: "task-1",
      dueDate: "2026-07-27",
      completedAt: "2026-07-27T10:00:00.000Z",
    };
    backup.data.completions = [
      completion,
      { ...completion, id: "completion-2" },
    ];

    expect(() => validateBackup(backup)).toThrow(
      "Completions contains duplicate task dates.",
    );
  });
});
