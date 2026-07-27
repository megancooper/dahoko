import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RepoSnapshot,
  WorkspaceBundleSnapshot,
} from "@/db/repo";
import type { EncryptedSyncBlob } from "./crypto";

const remoteHarness = vi.hoisted(() => ({
  revision: 0,
  blob: null as EncryptedSyncBlob | null,
}));

vi.mock("./api", () => {
  class SyncApiError extends Error {
    readonly status: number;
    readonly remote: {
      revision: number;
      blob: EncryptedSyncBlob | null;
    } | null;

    constructor(
      message: string,
      status = 0,
      remote: {
        revision: number;
        blob: EncryptedSyncBlob | null;
      } | null = null,
    ) {
      super(message);
      this.status = status;
      this.remote = remote;
    }
  }

  return {
    SyncApiError,
    getRemoteSyncState: vi.fn(async () => ({
      revision: remoteHarness.revision,
      blob: remoteHarness.blob,
    })),
    putRemoteSyncState: vi.fn(
      async (
        _serverUrl: string,
        _token: string,
        baseRevision: number,
        blob: EncryptedSyncBlob,
      ) => {
        if (baseRevision !== remoteHarness.revision) {
          throw new SyncApiError("conflict", 409, {
            revision: remoteHarness.revision,
            blob: remoteHarness.blob,
          });
        }
        remoteHarness.revision += 1;
        remoteHarness.blob = blob;
        return {
          revision: remoteHarness.revision,
          blob: remoteHarness.blob,
        };
      },
    ),
  };
});

import { deriveSyncKey } from "./crypto";
import { runEncryptedSync } from "./engine";

const statuses: RepoSnapshot["statuses"] = [
  {
    id: "status-backlog",
    name: "Backlog",
    color: "#808FA0",
    sortOrder: 0,
    isDone: false,
  },
  {
    id: "status-done",
    name: "Done",
    color: "#2A7A5C",
    sortOrder: 1,
    isDone: true,
  },
];

function snapshot(id: string, title: string): RepoSnapshot {
  return {
    tasks: [
      {
        id,
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
    lists: [],
    statuses,
    subtasks: [],
    completions: [],
  };
}

function bundle(id: string, title: string): WorkspaceBundleSnapshot {
  return {
    workspaces: [
      {
        workspace: {
          id: "workspace-personal",
          name: "Personal",
          color: "#A3D0FF",
          sortOrder: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        data: snapshot(id, title),
      },
    ],
  };
}

describe("encrypted multi-device sync", () => {
  beforeEach(() => {
    remoteHarness.revision = 0;
    remoteHarness.blob = null;
  });

  it("merges independent device data while the remote copy stays opaque", async () => {
    const salt = Buffer.alloc(32, 4).toString("base64");
    const key = await deriveSyncKey("a private encryption phrase", salt);
    const credentials = (deviceId: string) => ({
      serverUrl: "https://sync.example.test",
      token: "test-token",
      encryptionSalt: salt,
      key,
      deviceId,
    });

    const first = await runEncryptedSync(
      credentials("device-a"),
      bundle("task-a", "Private task from A"),
      null,
    );
    const secondDeviceBundle = bundle("task-b", "Private task from B");
    secondDeviceBundle.workspaces.push({
      workspace: {
        id: "workspace-studio",
        name: "Studio",
        color: "#FFD3A3",
        sortOrder: 1,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      data: {
        tasks: [
          {
            ...snapshot("studio-task", "Private studio task").tasks[0],
            statusId: "studio-status",
          },
        ],
        lists: [],
        statuses: [
          {
            id: "studio-status",
            name: "Backlog",
            color: "#808FA0",
            sortOrder: 0,
            isDone: false,
          },
        ],
        subtasks: [],
        completions: [],
      },
    });
    const second = await runEncryptedSync(
      credentials("device-b"),
      secondDeviceBundle,
      null,
    );
    const converged = await runEncryptedSync(
      credentials("device-a"),
      first.snapshot,
      first.localState,
    );

    expect(
      converged.snapshot.workspaces[0].data.tasks
        .map((task) => task.id)
        .sort(),
    ).toEqual(["task-a", "task-b"]);
    expect(second.snapshot.workspaces[0].data.tasks).toHaveLength(2);
    expect(
      converged.snapshot.workspaces.map(({ workspace }) => workspace.name),
    ).toEqual(["Personal", "Studio"]);
    expect(converged.snapshot.workspaces[1].data.tasks[0].title).toBe(
      "Private studio task",
    );
    expect(JSON.stringify(remoteHarness.blob)).not.toContain("Private task");
  });
});
