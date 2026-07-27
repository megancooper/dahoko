const ACTIVE_MODAL_LAYER_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
].join(",");

/**
 * Radix prevents outside interaction by temporarily setting pointer-events on
 * the body. WebViews can occasionally retain that inline style when animated,
 * overlapping dialogs unmount together. Remove only a proven-stale lock.
 */
export function releaseStaleDialogPointerLock(
  targetDocument: Document = document,
) {
  if (targetDocument.querySelector(ACTIVE_MODAL_LAYER_SELECTOR)) return;
  if (targetDocument.body.style.pointerEvents === "none") {
    targetDocument.body.style.removeProperty("pointer-events");
  }
}
