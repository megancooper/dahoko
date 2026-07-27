import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  defaultViewContextForFilter,
  defaultViewForFilter,
  normalizeSettings,
} from "./settings-model";

describe("normalizeSettings", () => {
  it("falls back safely when persisted values have invalid types", () => {
    expect(
      normalizeSettings(
        {
          defaultView: "calendar",
          defaultViews: {
            inbox: "not-a-view",
            recurring: 42,
          },
          showCompletedInInbox: "yes",
        },
        "sepia",
      ),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates the previous global default to every destination", () => {
    const settings = normalizeSettings(
      {
        defaultView: "board",
        showCompletedInInbox: false,
      },
      "dark",
    );

    expect(new Set(Object.values(settings.defaultViews))).toEqual(
      new Set(["board"]),
    );
    expect(settings.showCompletedInInbox).toBe(false);
    expect(settings.theme).toBe("dark");
  });

  it("accepts valid per-destination values and ignores invalid ones", () => {
    const settings = normalizeSettings(
      {
        defaultView: "board",
        defaultViews: {
          inbox: "list",
          recurring: "tags",
          lists: "invalid",
        },
      },
      null,
    );

    expect(settings.defaultViews.inbox).toBe("list");
    expect(settings.defaultViews.recurring).toBe("tags");
    expect(settings.defaultViews.lists).toBe("board");
  });
});

describe("default view resolution", () => {
  it("maps custom lists and tag filters to their settings contexts", () => {
    const defaultViews = {
      ...DEFAULT_SETTINGS.defaultViews,
      lists: "board" as const,
      tags: "tags" as const,
    };

    expect(defaultViewContextForFilter("list")).toBe("lists");
    expect(defaultViewContextForFilter("tag")).toBe("tags");
    expect(defaultViewForFilter(defaultViews, "list")).toBe("board");
    expect(defaultViewForFilter(defaultViews, "tag")).toBe("tags");
  });
});
