import { describe, expect, it } from "vitest";
import {
  decryptSyncDocument,
  deriveSyncKey,
  encryptSyncDocument,
} from "./crypto";
import { buildLocalSyncBundle } from "./bundle";

const salt = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index)),
);

function document() {
  return buildLocalSyncBundle(
    {
      workspaces: [
        {
          workspace: {
            id: "workspace-personal",
            name: "Personal",
            color: "#A3D0FF",
            sortOrder: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          data: {
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
            tasks: [],
            subtasks: [],
            completions: [],
          },
        },
      ],
    },
    null,
    { millis: 0, counter: 0 },
    "device-a",
    100,
  ).document;
}

describe("encrypted sync crypto", () => {
  it("round-trips a document using authenticated encryption", async () => {
    const key = await deriveSyncKey("a private encryption phrase", salt);
    const encrypted = await encryptSyncDocument(document(), key, salt);
    const decrypted = await decryptSyncDocument(encrypted, key, salt);

    expect(decrypted).toEqual(document());
    expect(encrypted.ciphertext).not.toContain("Backlog");
  });

  it("fails closed when the passphrase is wrong", async () => {
    const correctKey = await deriveSyncKey("correct private phrase", salt);
    const wrongKey = await deriveSyncKey("wrong private phrase", salt);
    const encrypted = await encryptSyncDocument(document(), correctKey, salt);

    await expect(
      decryptSyncDocument(encrypted, wrongKey, salt),
    ).rejects.toThrow("passphrase is incorrect");
  });
});
