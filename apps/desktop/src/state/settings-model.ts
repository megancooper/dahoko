export type ThemePreference = "system" | "light" | "dark";
export type DefaultView = "list" | "board" | "tags";
export type DefaultViewContext =
  | "inbox"
  | "today"
  | "next7"
  | "completed"
  | "recurring"
  | "lists"
  | "tags";

export type DefaultViews = Record<DefaultViewContext, DefaultView>;

export interface Settings {
  theme: ThemePreference;
  defaultViews: DefaultViews;
  /** Keep tasks completed today visible in the Inbox */
  showCompletedInInbox: boolean;
}

export const DEFAULT_VIEW_CONTEXTS: readonly DefaultViewContext[] = [
  "inbox",
  "today",
  "next7",
  "completed",
  "recurring",
  "lists",
  "tags",
];

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultViews: {
    inbox: "list",
    today: "list",
    next7: "list",
    completed: "list",
    recurring: "list",
    lists: "list",
    tags: "tags",
  },
  showCompletedInInbox: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDefaultView(value: unknown): value is DefaultView {
  return value === "list" || value === "board" || value === "tags";
}

export function normalizeSettings(
  storedValue: unknown,
  storedTheme: unknown,
): Settings {
  const stored = isRecord(storedValue) ? storedValue : {};
  const legacyDefault = isDefaultView(stored.defaultView)
    ? stored.defaultView
    : null;
  const defaultViews = Object.fromEntries(
    DEFAULT_VIEW_CONTEXTS.map((context) => [
      context,
      legacyDefault ?? DEFAULT_SETTINGS.defaultViews[context],
    ]),
  ) as DefaultViews;

  if (isRecord(stored.defaultViews)) {
    for (const context of DEFAULT_VIEW_CONTEXTS) {
      const candidate = stored.defaultViews[context];
      if (isDefaultView(candidate)) defaultViews[context] = candidate;
    }
  }

  return {
    theme:
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : "system",
    defaultViews,
    showCompletedInInbox:
      typeof stored.showCompletedInInbox === "boolean"
        ? stored.showCompletedInInbox
        : DEFAULT_SETTINGS.showCompletedInInbox,
  };
}

export function defaultViewContextForFilter(
  filterKind: "inbox" | "today" | "next7" | "completed" | "recurring" | "list" | "tag",
): DefaultViewContext {
  if (filterKind === "list") return "lists";
  if (filterKind === "tag") return "tags";
  return filterKind;
}

export function defaultViewForFilter(
  defaultViews: DefaultViews,
  filterKind: Parameters<typeof defaultViewContextForFilter>[0],
): DefaultView {
  return defaultViews[defaultViewContextForFilter(filterKind)];
}
