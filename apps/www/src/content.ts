import {
  ArrowLeftRight,
  Download,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DocSlug =
  | "getting-started"
  | "quick-add"
  | "views"
  | "workspaces"
  | "encrypted-sync"
  | "import-export"
  | "self-hosting";

export interface DocPage {
  slug: DocSlug;
  title: string;
  description: string;
  group: "Start here" | "Using Dahoko" | "Data & privacy";
  icon: LucideIcon;
  sections: Array<{ id: string; label: string }>;
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description:
      "Install Dahoko, create your first task, and choose the view that fits your work.",
    group: "Start here",
    icon: Download,
    sections: [
      { id: "install", label: "Install Dahoko" },
      { id: "first-task", label: "Create your first task" },
      { id: "choose-view", label: "Choose a view" },
      { id: "next-steps", label: "Next steps" },
    ],
  },
  {
    slug: "quick-add",
    title: "Quick add",
    description:
      "Create complete tasks from one line using natural dates, priorities, and tags.",
    group: "Start here",
    icon: Keyboard,
    sections: [
      { id: "syntax", label: "Syntax" },
      { id: "dates", label: "Dates and times" },
      { id: "organization", label: "Tags and priorities" },
      { id: "examples", label: "Examples" },
    ],
  },
  {
    slug: "views",
    title: "Views",
    description:
      "Move between focused lists, fluid swimlanes, and grouped task views.",
    group: "Using Dahoko",
    icon: LayoutDashboard,
    sections: [
      { id: "available-views", label: "Available views" },
      { id: "swimlanes", label: "Swimlanes" },
      { id: "defaults", label: "Default views" },
      { id: "zoom", label: "Desktop zoom" },
    ],
  },
  {
    slug: "workspaces",
    title: "Workspaces",
    description:
      "Separate projects and contexts without giving up a fast, unified workflow.",
    group: "Using Dahoko",
    icon: ListChecks,
    sections: [
      { id: "create", label: "Create a workspace" },
      { id: "switch", label: "Switch workspaces" },
      { id: "isolation", label: "Data isolation" },
      { id: "sync", label: "Workspace sync" },
    ],
  },
  {
    slug: "encrypted-sync",
    title: "Encrypted sync",
    description:
      "Sync every workspace between devices while keeping readable data off the server.",
    group: "Data & privacy",
    icon: LockKeyhole,
    sections: [
      { id: "model", label: "Privacy model" },
      { id: "connect", label: "Connect a device" },
      { id: "conflicts", label: "Conflict handling" },
      { id: "recovery", label: "Passphrases and recovery" },
    ],
  },
  {
    slug: "import-export",
    title: "Import and export",
    description:
      "Move, back up, or restore a workspace with a portable Dahoko data file.",
    group: "Data & privacy",
    icon: ArrowLeftRight,
    sections: [
      { id: "export", label: "Export a workspace" },
      { id: "import", label: "Import a workspace" },
      { id: "safety", label: "Restore safely" },
    ],
  },
  {
    slug: "self-hosting",
    title: "Self-host sync",
    description:
      "Run the small open-source sync service on infrastructure you control.",
    group: "Data & privacy",
    icon: ServerCog,
    sections: [
      { id: "requirements", label: "Requirements" },
      { id: "docker", label: "Run with Docker" },
      { id: "configuration", label: "Configuration" },
      { id: "operations", label: "Operations" },
    ],
  },
];

export const DOC_GROUPS = ["Start here", "Using Dahoko", "Data & privacy"] as const;

export const DOC_PAGE_BY_SLUG = new Map(
  DOC_PAGES.map((page) => [page.slug, page]),
);

export function isDocSlug(value: string): value is DocSlug {
  return DOC_PAGE_BY_SLUG.has(value as DocSlug);
}

export const FEATURE_HIGHLIGHTS = [
  {
    icon: RefreshCw,
    title: "Every view, one task list",
    body: "Move between list, swimlane, tag, and priority views without duplicating or reorganizing your data.",
  },
  {
    icon: LockKeyhole,
    title: "Private by construction",
    body: "Your SQLite database stays local. Optional sync is end-to-end encrypted before anything leaves your device.",
  },
  {
    icon: ListChecks,
    title: "Workspaces with boundaries",
    body: "Keep personal plans, client work, and recurring routines isolated—then switch context in one click.",
  },
] as const;
