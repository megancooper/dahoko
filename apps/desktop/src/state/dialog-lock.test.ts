import { describe, expect, it, vi } from "vitest";
import { releaseStaleDialogPointerLock } from "@dahoko/ui";

function fakeDocument(hasActiveLayer: boolean, pointerEvents = "none") {
  const removeProperty = vi.fn();
  const targetDocument = {
    querySelector: vi.fn(() => (hasActiveLayer ? {} : null)),
    body: {
      style: {
        pointerEvents,
        removeProperty,
      },
    },
  } as unknown as Document;

  return { targetDocument, removeProperty };
}

describe("releaseStaleDialogPointerLock", () => {
  it("removes a stale body lock after the last modal closes", () => {
    const { targetDocument, removeProperty } = fakeDocument(false);

    releaseStaleDialogPointerLock(targetDocument);

    expect(removeProperty).toHaveBeenCalledWith("pointer-events");
  });

  it("preserves the body lock while another modal layer is open", () => {
    const { targetDocument, removeProperty } = fakeDocument(true);

    releaseStaleDialogPointerLock(targetDocument);

    expect(removeProperty).not.toHaveBeenCalled();
  });
});
