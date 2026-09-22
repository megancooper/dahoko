import { isTauri } from "@/db/index";

/**
 * Open a URL in the user's default browser.
 *
 * WKWebView (macOS) and WebView2 never implement `window.open` for the
 * Tauri window, so the call silently returns null and nothing happens. The
 * opener plugin hands the URL to the OS instead; the browser build keeps
 * using a new tab. Only http(s) URLs are accepted so a malformed checkout
 * response can never launch an arbitrary scheme.
 */
export async function openExternal(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The link is not a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only web links can be opened.");
  }
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(parsed.toString());
    return;
  }
  const opened = window.open(parsed.toString(), "_blank", "noopener,noreferrer");
  if (!opened) {
    throw new Error("Your browser blocked the popup. Use the link below.");
  }
}
