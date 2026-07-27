import { describe, expect, it } from "vitest";
import { MemoryRepo } from "./memory";
import type { RepoSnapshot } from "./repo";

const importedSnapshot: RepoSnapshot = {
  statuses: [
    {
      id: "status-open",
      name: "Open",
      color: "#808FA0",
      sortOrder: 0,
      isDone: false,
    },
  ],
  lists: [],
  tasks: [
    {
      id: "task-imported",
      title: "Imported task",
      notes: "",
      dueAt: null,
      hasDueTime: false,
      priority: 0,
      listId: null,
      statusId: "status-open",
      tags: ["backup"],
      recurrence: null,
      completedAt: null,
      sortOrder: 0,
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
    },
  ],
  subtasks: [],
  completions: [],
};

describe("MemoryRepo.replaceData", () => {
  it("replaces every collection and does not retain the caller's arrays", async () => {
    const repo = new MemoryRepo();
    await repo.init();
    await repo.replaceData(importedSnapshot);

    importedSnapshot.tasks[0]!.tags.push("changed-after-import");

    await expect(repo.listTasks()).resolves.toEqual([
      expect.objectContaining({
        id: "task-imported",
        title: "Imported task",
        tags: ["backup"],
      }),
    ]);
    await expect(repo.listLists()).resolves.toEqual([]);
    await expect(repo.listSubtasks("task-imported")).resolves.toEqual([]);
    await expect(repo.listCompletions()).resolves.toEqual([]);
  });

  it("isolates records while switching between workspaces", async () => {
    const repo = new MemoryRepo();
    await repo.init();
    const personalId = repo.getActiveWorkspaceId();
    const work = await repo.createWorkspace("Work", "#FFD3A3");
    await repo.setActiveWorkspace(work.id);
    await repo.createTask({ title: "Work-only task" });

    await expect(repo.listTasks()).resolves.toEqual([
      expect.objectContaining({ title: "Work-only task" }),
    ]);
    await repo.setActiveWorkspace(personalId);
    const personalTasks = await repo.listTasks();
    expect(personalTasks.some((task) => task.title === "Work-only task")).toBe(
      false,
    );
  });
});
