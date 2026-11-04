import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CircleCheck,
  Cloud,
  Columns3,
  Download,
  EyeOff,
  Github,
  HardDrive,
  Inbox,
  LayoutList,
  LockKeyhole,
  Plus,
  Repeat,
  Server,
  Tags,
} from "lucide-react";
import { cn } from "@dahoko/ui";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import desktopConfig from "../../desktop/src-tauri/tauri.conf.json";
import { InternalLink } from "./docs";

const REPO_URL = "https://github.com/megancooper/dahoko";
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;
const RELEASE_URL = `${REPO_URL}/releases/tag/app-v${desktopConfig.version}`;

type RevealStyle = CSSProperties & { "--i"?: string };

function reveal(index: number): RevealStyle {
  return { "--i": String(index) };
}

/* ------------------------------------------------------------------------- */
/* Demo data — illustrative task content, matches the product's real model.  */
/* ------------------------------------------------------------------------- */

const VIEW_MODES = [
  { id: "list", label: "List", icon: LayoutList },
  { id: "swimlanes", label: "Swimlanes", icon: Columns3 },
  { id: "tags", label: "By tag", icon: Tags },
] as const;

type ViewMode = (typeof VIEW_MODES)[number]["id"];

type TagTone = "blue" | "mint" | "sand";

const VIEW_TASKS = [
  { title: "Send launch notes", tag: "release", tone: "sand", priority: "P1", due: "Today", status: "doing" },
  { title: "Review sync security model", tag: "privacy", tone: "mint", priority: "P2", due: "Today", status: "todo" },
  { title: "Fix export flow", tag: "release", tone: "sand", priority: "P1", due: "Thu", status: "doing" },
  { title: "Update the docs", tag: "release", tone: "sand", priority: "P2", due: "Fri", status: "todo" },
  { title: "Plan the week", tag: "personal", tone: "blue", priority: "P3", due: "Fri", status: "todo" },
  { title: "Book the dentist", tag: "personal", tone: "blue", priority: "P3", due: "Sat", status: "todo" },
] as const satisfies ReadonlyArray<{
  title: string;
  tag: string;
  tone: TagTone;
  priority: string;
  due: string;
  status: "todo" | "doing";
}>;

const WORKSPACES = [
  {
    id: "personal",
    name: "Personal",
    initial: "P",
    tone: "blue",
    count: 7,
    tasks: ["Book the dentist", "Pack for Portland", "Water the basil", "Renew passport"],
  },
  {
    id: "studio",
    name: "Studio",
    initial: "S",
    tone: "sand",
    count: 12,
    tasks: ["Review client cut", "Send launch brief", "Invoice Northstar", "Book color grade"],
  },
  {
    id: "routines",
    name: "Routines",
    initial: "R",
    tone: "mint",
    count: 5,
    tasks: ["Weekly planning", "Recurring metrics", "Back up archive", "Clear the inbox"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  initial: string;
  tone: TagTone;
  count: number;
  tasks: readonly string[];
}>;

type WorkspaceId = (typeof WORKSPACES)[number]["id"];

const PRICING = {
  monthly: { label: "$4", cadence: "per month" },
  yearly: { label: "$40", cadence: "per year · 2 months free" },
} as const;

const FREE_FEATURES = [
  "The full desktop app — every feature, forever",
  "Unlimited tasks, lists & workspaces",
  "All views: list, swimlanes, by tag",
  "Recurring tasks & completion metrics",
  "Local backups & restore",
  "Self-hosted encrypted sync on your own server",
];

const PRO_FEATURES = [
  "Hosted end-to-end encrypted sync — no server to run",
  "Every device stays current, automatically",
  "Off-site encrypted backup of every workspace",
  "Priority support from the maintainers",
  "Funds open, MIT-licensed development",
];

const MORE_FEATURES = [
  {
    title: "Views",
    body: "List, swimlanes with drag and drop, and grouping by tag, list, or priority. One task collection, no copies.",
  },
  {
    title: "Recurring tasks",
    body: "Routines repeat on their own schedule, with completion metrics that show how you are keeping up.",
  },
  {
    title: "Import and export",
    body: "Move, back up, or restore a workspace with a single portable data file.",
  },
  {
    title: "Local backups",
    body: "Back up and restore from your own device. No server involved.",
  },
  {
    title: "Self-hosted sync",
    body: "Run the small open-source sync service on infrastructure you control.",
  },
  {
    title: "Open source",
    body: "MIT licensed. Read every line, fork it, and build it yourself.",
  },
];

/* ------------------------------------------------------------------------- */
/* Page                                                                      */
/* ------------------------------------------------------------------------- */

export function LandingExperience({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  useRevealOnScroll();

  return (
    <>
      <CheckoutSuccessBanner />
      <main>
        <Hero onNavigate={onNavigate} />
        <QuickAddSection onNavigate={onNavigate} />
        <SyncSection onNavigate={onNavigate} />
        <WorkspacesSection onNavigate={onNavigate} />
        <MoreSection />
        <CloudPricing onNavigate={onNavigate} />
        <Closing />
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </>
  );
}

/**
 * Adds `is-in` to every `[data-reveal]` element once it scrolls into view so
 * the `.mk-io` transition can play. Reduced-motion users (and browsers
 * without IntersectionObserver) see everything immediately.
 */
function useRevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (nodes.length === 0) return undefined;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-in"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

/* ------------------------------------------------------------------------- */
/* Hero                                                                      */
/* ------------------------------------------------------------------------- */

function Hero({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="mk-hero">
      <div className="mk-grid" aria-hidden="true" />
      <div className="mk-hero-glow" aria-hidden="true" />

      <div className="mk-frame">
        <a
          href={RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          className="mk-eyebrow mk-reveal"
          style={reveal(0)}
        >
          <code>v{desktopConfig.version}</code>
          Encrypted sync is here
          <ArrowRight aria-hidden="true" />
        </a>

        <h1 className="mk-hero-title mk-reveal" style={reveal(1)}>
          <span>The private,</span> <span>local-first</span>{" "}
          <span>task manager.</span>
        </h1>

        <p className="mk-hero-lede mk-reveal" style={reveal(2)}>
          Capture a task in one line, switch views without duplicating
          anything, and keep work in separate workspaces. Everything lives in
          SQLite on your device. Sync is optional and end-to-end encrypted.
        </p>

        <div className="mk-hero-actions mk-reveal" style={reveal(3)}>
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="mk-btn mk-btn-primary mk-btn-lg"
          >
            <Download aria-hidden="true" />
            Download for desktop
          </a>
          <InternalLink
            href="/docs/getting-started"
            onNavigate={onNavigate}
            className="mk-btn mk-btn-secondary mk-btn-lg"
          >
            Read the docs
            <ArrowRight aria-hidden="true" />
          </InternalLink>
        </div>

        <p className="mk-hero-meta mk-reveal" style={reveal(4)}>
          <span>
            <Check aria-hidden="true" />
            macOS · Windows · Linux
          </span>
          <span>
            <Check aria-hidden="true" />
            MIT licensed
          </span>
          <span>
            <Check aria-hidden="true" />
            No account required
          </span>
        </p>

        <div className="mk-shot mk-reveal" style={reveal(5)}>
          <ProductWindow />
          <div className="mk-shot-fade" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function ProductWindow() {
  const [mode, setMode] = useState<ViewMode>("list");
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <div className="mk-window" aria-label="Dahoko desktop app preview">
      <div className="mk-titlebar">
        <div className="mk-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="mk-titlebar-title">Dahoko — Personal</span>
        <span className="mk-titlebar-status">Encrypted · synced</span>
      </div>

      <div className="mk-app">
        <aside className="mk-sidebar" aria-hidden="true">
          <div className="mk-ws">
            <span className="mk-ws-avatar">P</span>
            <div>
              <small>Workspace</small>
              <strong>Personal</strong>
            </div>
            <ChevronsUpDown />
          </div>
          <div className="mk-side-item">
            <Inbox />
            Inbox
            <span>3</span>
          </div>
          <div className="mk-side-item is-active">
            <CalendarDays />
            Today
            <span>2</span>
          </div>
          <div className="mk-side-item">
            <CalendarClock />
            Upcoming
            <span>4</span>
          </div>
          <div className="mk-side-item">
            <Repeat />
            Recurring
          </div>
          <div className="mk-side-item">
            <CircleCheck />
            Completed
          </div>
          <p className="mk-side-label">Lists</p>
          <div className="mk-side-item">
            <i className="mk-side-dot is-sand" />
            Launch
          </div>
          <div className="mk-side-item">
            <i className="mk-side-dot is-blue" />
            Personal
          </div>
          <div className="mk-side-item">
            <i className="mk-side-dot is-mint" />
            Routines
          </div>
        </aside>

        <div className="mk-main">
          <div className="mk-main-head">
            <div>
              <small>{today}</small>
              <strong>Today</strong>
            </div>
            <div
              className="mk-seg"
              role="group"
              aria-label="Switch the preview between views"
            >
              {VIEW_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  onClick={() => setMode(item.id)}
                >
                  <item.icon aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mk-quickadd" aria-hidden="true">
            <Plus />
            <span className="mk-quickadd-text">
              Draft launch notes <mark>tomorrow</mark> <mark>#release</mark>{" "}
              <mark>!p1</mark>
            </span>
            <kbd>Enter</kbd>
          </div>

          <div className="mk-scene" key={mode}>
            {mode === "list" ? <ListScene /> : null}
            {mode === "swimlanes" ? <SwimlaneScene /> : null}
            {mode === "tags" ? <TagScene /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListScene() {
  return (
    <div className="mk-rows">
      {VIEW_TASKS.map((task) => (
        <div className="mk-row" key={task.title}>
          <span
            className={cn("mk-check", task.due === "Today" && "is-today")}
          />
          <span className="mk-row-title">
            <strong>{task.title}</strong>
            <span className={cn("mk-tag", `is-${task.tone}`)}>#{task.tag}</span>
          </span>
          <span className={cn("mk-row-meta", task.due === "Today" && "is-today")}>
            <span className={cn("mk-tag", task.priority === "P1" && "is-p1")}>
              {task.priority}
            </span>
            {task.due}
          </span>
        </div>
      ))}
      <div className="mk-row is-done">
        <span className="mk-check is-done">
          <Check aria-hidden="true" strokeWidth={3} />
        </span>
        <span className="mk-row-title">
          <strong>Water the basil</strong>
          <span className="mk-tag">#home</span>
        </span>
        <span className="mk-row-meta">Done</span>
      </div>
    </div>
  );
}

function SwimlaneScene() {
  const lanes = [
    { label: "To do", tasks: VIEW_TASKS.filter((task) => task.status === "todo") },
    { label: "Doing", tasks: VIEW_TASKS.filter((task) => task.status === "doing") },
    { label: "Done", tasks: [] },
  ];
  return (
    <div className="mk-lanes">
      {lanes.map((lane) => (
        <div className="mk-lane" key={lane.label}>
          <p className="mk-lane-head">
            {lane.label}
            <span>{lane.label === "Done" ? 1 : lane.tasks.length}</span>
          </p>
          {lane.tasks.map((task) => (
            <div className="mk-card" key={task.title}>
              <strong>{task.title}</strong>
              <span className="mk-row-meta">
                <span className={cn("mk-tag", `is-${task.tone}`)}>#{task.tag}</span>
                {task.due}
              </span>
            </div>
          ))}
          {lane.label === "Done" ? (
            <div className="mk-card">
              <strong>Water the basil</strong>
              <span className="mk-row-meta">
                <span className="mk-tag">#home</span>
                Done
              </span>
            </div>
          ) : null}
          <div className="mk-card is-ghost">Drop here</div>
        </div>
      ))}
    </div>
  );
}

function TagScene() {
  const groups = ["release", "personal", "privacy"].map((tag) => ({
    tag,
    tasks: VIEW_TASKS.filter((task) => task.tag === tag),
  }));
  return (
    <div className="mk-groups">
      {groups.map((group) => (
        <section key={group.tag}>
          <p className="mk-group-head">
            <span className={cn("mk-tag", `is-${group.tasks[0].tone}`)}>
              #{group.tag}
            </span>
            <small>{group.tasks.length}</small>
          </p>
          <div className="mk-rows">
            {group.tasks.map((task) => (
              <div className="mk-row" key={task.title}>
                <span
                  className={cn("mk-check", task.due === "Today" && "is-today")}
                />
                <span className="mk-row-title">
                  <strong>{task.title}</strong>
                </span>
                <span className={cn("mk-row-meta", task.due === "Today" && "is-today")}>
                  <span className={cn("mk-tag", task.priority === "P1" && "is-p1")}>
                    {task.priority}
                  </span>
                  {task.due}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Feature sections                                                          */
/* ------------------------------------------------------------------------- */

function QuickAddSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="mk-section">
      <div className="mk-frame">
        <div className="mk-feature">
          <div className="mk-feature-copy mk-io" data-reveal>
            <p className="mk-kicker">Quick add</p>
            <h2 className="mk-h2">One line in. A complete task out.</h2>
            <p className="mk-lede">
              Type the title with a date, a <strong>#tag</strong>, and a{" "}
              <strong>!priority</strong> in any order. Dahoko stores the
              structured task and keeps the title clean. Open the detail view
              later for notes, subtasks, recurrence, or a specific status.
            </p>
            <div className="mk-links">
              <InternalLink
                href="/docs/quick-add"
                onNavigate={onNavigate}
                className="mk-link"
              >
                Quick add syntax
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </InternalLink>
            </div>
          </div>

          <div className="mk-panel mk-io" data-reveal>
            <div className="mk-panel-head">
              <span>Quick add</span>
              <span>Inbox · Personal</span>
            </div>
            <div className="mk-panel-body">
              <div className="mk-qa-input" aria-label="Quick add example">
                <Plus aria-hidden="true" />
                <span className="mk-qa-line">
                  Call the accountant&nbsp;<mark>tomorrow</mark>&nbsp;
                  <mark className="is-mint">#finance</mark>&nbsp;
                  <mark className="is-sand">!p1</mark>
                  <span className="mk-qa-caret" aria-hidden="true" />
                </span>
              </div>
              <dl className="mk-qa-parsed">
                <dt>Title</dt>
                <dd>Call the accountant</dd>
                <dt>Due</dt>
                <dd>Tomorrow</dd>
                <dt>Tag</dt>
                <dd>#finance</dd>
                <dt>Priority</dt>
                <dd>P1</dd>
              </dl>
              <div className="mk-qa-examples" aria-label="More examples">
                <p>Plan team retro Friday at 10:00 #work</p>
                <p>Replace water filter #home !p3</p>
                <p>Renew certificate 2026-08-15</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SyncSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="mk-section">
      <div className="mk-frame">
        <div className="mk-feature is-flipped">
          <div className="mk-feature-copy mk-io" data-reveal>
            <p className="mk-kicker">Encrypted sync</p>
            <h2 className="mk-h2">
              The server carries it.
              <br />
              It can’t read it.
            </h2>
            <p className="mk-lede">
              Your readable SQLite database stays on your device. When you turn
              sync on, each workspace is sealed with a key derived from your
              passphrase before anything is uploaded. The sync service stores
              ciphertext and nothing else.
            </p>
            <div className="mk-links">
              <InternalLink
                href="/docs/encrypted-sync"
                onNavigate={onNavigate}
                className="mk-link"
              >
                Read the security model
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </InternalLink>
              <InternalLink
                href="/docs/self-hosting"
                onNavigate={onNavigate}
                className="mk-link"
              >
                Self-host the server
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </InternalLink>
            </div>
          </div>

          <div className="mk-panel mk-io" data-reveal>
            <div className="mk-panel-head">
              <span>Data path</span>
              <span>Zero knowledge</span>
            </div>
            <div className="mk-panel-body">
              <div className="mk-path" aria-label="Encrypted sync data path">
                <div className="mk-node is-local">
                  <span className="mk-node-icon">
                    <HardDrive aria-hidden="true" />
                  </span>
                  <strong>Your device</strong>
                  <small>
                    <Check aria-hidden="true" />
                    Readable SQLite
                  </small>
                </div>
                <div className="mk-rail" aria-hidden="true">
                  <span className="mk-rail-line" />
                  <span className="mk-rail-dot" />
                  <span className="mk-rail-packet">
                    <LockKeyhole />
                    AES-256-GCM
                  </span>
                </div>
                <div className="mk-node is-server">
                  <span className="mk-node-icon">
                    <Server aria-hidden="true" />
                  </span>
                  <strong>Sync server</strong>
                  <small>
                    <EyeOff aria-hidden="true" />
                    Ciphertext only
                  </small>
                </div>
              </div>
              <div className="mk-path-steps">
                <p>
                  <span>01</span>
                  Write locally
                </p>
                <p>
                  <span>02</span>
                  Seal before upload
                </p>
                <p>
                  <span>03</span>
                  Sync without visibility
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspacesSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>("personal");
  const workspace = WORKSPACES.find((item) => item.id === workspaceId)!;

  return (
    <section className="mk-section">
      <div className="mk-frame">
        <div className="mk-feature">
          <div className="mk-feature-copy mk-io" data-reveal>
            <p className="mk-kicker">Workspaces</p>
            <h2 className="mk-h2">Same app. Separate rooms.</h2>
            <p className="mk-lede">
              A workspace has its own lists, statuses, tags, completion
              history, and tasks. Keep client work away from personal plans,
              switch context in one click, and let sync boundaries follow the
              workspace.
            </p>
            <div className="mk-links">
              <InternalLink
                href="/docs/workspaces"
                onNavigate={onNavigate}
                className="mk-link"
              >
                Explore workspaces
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </InternalLink>
            </div>
          </div>

          <div className="mk-panel mk-io" data-reveal>
            <div className="mk-tabs" role="group" aria-label="Preview a workspace">
              {WORKSPACES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mk-tab"
                  aria-pressed={item.id === workspaceId}
                  onClick={() => setWorkspaceId(item.id)}
                >
                  <span className={cn("mk-tab-avatar", `is-${item.tone}`)}>
                    {item.initial}
                  </span>
                  {item.name}
                  <small>{item.count}</small>
                </button>
              ))}
            </div>
            <div className="mk-ws-panel">
              <div className="mk-ws-panel-head">
                <span>{workspace.name} · Today</span>
                <span>{workspace.count} open</span>
              </div>
              <div className="mk-rows mk-scene" key={workspace.id}>
                {workspace.tasks.map((task, index) => (
                  <div className="mk-row" key={task}>
                    <span className={cn("mk-check", index === 0 && "is-today")} />
                    <span className="mk-row-title">
                      <strong>{task}</strong>
                    </span>
                    <span className={cn("mk-row-meta", index === 0 && "is-today")}>
                      {["Today", "Tomorrow", "Thu", "Later"][index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MoreSection() {
  return (
    <section className="mk-section">
      <div className="mk-frame">
        <div className="mk-feature-copy mk-io" data-reveal>
          <p className="mk-kicker">Everything else</p>
          <h2 className="mk-h2">Included, not upsold.</h2>
          <p className="mk-lede">
            The desktop app is complete on its own. There are no feature gates
            and no task limits.
          </p>
        </div>
        <div className="mk-grid-list mk-io" data-reveal>
          {MORE_FEATURES.map((item, index) => (
            <div key={item.title}>
              <span>0{index + 1}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Pricing                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Stripe returns the browser to `/?checkout=success` after checkout. The
 * banner renders at the top of the page rather than beside the plans: the
 * reader arrives having already paid, so the confirmation should be the first
 * thing on screen instead of a scroll away.
 */
function CheckoutSuccessBanner() {
  const [returned] = useState(
    () =>
      new URLSearchParams(window.location.search).get("checkout") === "success",
  );

  useEffect(() => {
    if (!returned) return;
    // Drop the marker so reloading or sharing the URL does not replay a
    // purchase confirmation that already happened.
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [returned]);

  if (!returned) return null;

  return (
    <div
      role="status"
      className="border-b border-success/30 bg-success/10 px-4 py-3.5"
    >
      <div className="mk-frame flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">You’re on Dahoko Cloud.</p>
          <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
            Head back to the Dahoko app — your plan updates automatically and
            encrypted sync starts on the next pass. Manage or cancel anytime
            from Settings → Sync.
          </p>
        </div>
      </div>
    </div>
  );
}

function CloudPricing({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const price = PRICING[interval];

  return (
    <section id="cloud" className="mk-section">
      <div className="mk-frame">
        <div className="mk-section-head mk-io" data-reveal>
          <p className="mk-kicker">Dahoko Cloud</p>
          <h2 className="mk-h2">
              Free where you work.
              <br />
              Paid only where we do.
            </h2>
          <p className="mk-lede">
            The app is free and complete. Pro pays for the one thing that costs
            us money: running the encrypted sync servers so you don’t have to.
          </p>
        </div>

        <div className="mk-plans mk-io" data-reveal>
          <article className="mk-plan">
            <h3 className="mk-plan-name">Free</h3>
            <p className="mk-plan-sub">Local-first, yours forever</p>
            <p className="mk-plan-price">
              <strong>$0</strong>
              <span>no account required</span>
            </p>
            <ul>
              {FREE_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="mk-btn mk-btn-secondary mk-btn-lg mt-auto"
            >
              <Download aria-hidden="true" />
              Download free
            </a>
          </article>

          <article className="mk-plan is-pro">
            <h3 className="mk-plan-name">
              Dahoko Cloud
              <span>Pro</span>
            </h3>
            <p className="mk-plan-sub">Hosted encrypted sync</p>
            <p className="mk-plan-price">
              <strong>{price.label}</strong>
              <span>{price.cadence}</span>
            </p>
            <div
              role="group"
              aria-label="Billing interval"
              className="mk-interval"
            >
              {(["monthly", "yearly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={interval === option}
                  onClick={() => setInterval(option)}
                >
                  {option === "monthly" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
            <ul>
              <li className="is-lead">
                <Check aria-hidden="true" />
                Everything in Free, plus
              </li>
              {PRO_FEATURES.map((feature) => (
                <li key={feature}>
                  <Check aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mk-plan-note">
              <LockKeyhole aria-hidden="true" />
              Cancel anytime. Your data is end-to-end encrypted and stays
              downloadable even after a subscription lapses — never hostage.
            </p>
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="mk-btn mk-btn-primary mk-btn-lg mt-auto"
            >
              <Cloud aria-hidden="true" />
              Get the app, upgrade inside
            </a>
            <p className="mk-plan-foot">
              Checkout opens from Settings → Sync, powered by Stripe.{" "}
              <InternalLink href="/docs/encrypted-sync" onNavigate={onNavigate}>
                How encryption works
              </InternalLink>
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Closing + footer                                                          */
/* ------------------------------------------------------------------------- */

function Closing() {
  return (
    <section className="mk-closing mk-section">
      <div className="mk-grid" aria-hidden="true" />
      <div className="mk-frame mk-io" data-reveal>
        <h2>Your next task can stay yours.</h2>
        <p className="mk-lede">
          Download Dahoko, open a local workspace, and start typing. No signup
          wall and no cloud database required.
        </p>
        <div className="mk-hero-actions">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="mk-btn mk-btn-primary mk-btn-lg"
          >
            <Download aria-hidden="true" />
            Download for desktop
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mk-btn mk-btn-secondary mk-btn-lg"
          >
            <Github aria-hidden="true" />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <footer className="mk-footer">
      <div className="mk-frame mk-footer-row">
        <div className="mk-footer-brand">
          <span className="mk-brand-mark" aria-hidden="true">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <div>
            <strong>dahoko</strong>
            <small>Private task management, built in the open.</small>
          </div>
        </div>
        <nav aria-label="Footer" className="mk-footer-links">
          <InternalLink href="/docs/getting-started" onNavigate={onNavigate}>
            Documentation
          </InternalLink>
          <a href="/#cloud">Pricing</a>
          <InternalLink href="/docs/self-hosting" onNavigate={onNavigate}>
            Self-host
          </InternalLink>
          <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer">
            Releases
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
          <InternalLink href="/account" onNavigate={onNavigate}>
            Account
          </InternalLink>
          <span>© {new Date().getFullYear()} contributors</span>
        </nav>
      </div>
    </footer>
  );
}
