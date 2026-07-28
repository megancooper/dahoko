import {
  ArrowRight,
  Check,
  Columns3,
  Download,
  EyeOff,
  Hash,
  Laptop,
  ListChecks,
  LockKeyhole,
  Server,
  Star,
} from "lucide-react";
import { Button } from "@dahoko/ui";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import desktopConfig from "../../desktop/src-tauri/tauri.conf.json";
import { InternalLink } from "./docs";

const REPO_URL = "https://github.com/megancooper/dahoko";
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

const RAIN_TASKS = [
  {
    label: "Book the dentist",
    meta: "tomorrow",
    x: 4,
    delay: -3,
    duration: 17,
    drift: 90,
    tilt: -3,
    depth: "far",
  },
  {
    label: "Review pull request",
    meta: "#studio",
    x: 14,
    delay: -12,
    duration: 20,
    drift: -70,
    tilt: 2,
    depth: "near",
  },
  {
    label: "Water the basil",
    meta: "#home",
    x: 26,
    delay: -7,
    duration: 16,
    drift: 45,
    tilt: -1,
    depth: "mid",
  },
  {
    label: "Send launch brief",
    meta: "P1",
    x: 38,
    delay: -15,
    duration: 22,
    drift: -110,
    tilt: 4,
    depth: "far",
  },
  {
    label: "Renew passport",
    meta: "Oct 12",
    x: 50,
    delay: -5,
    duration: 18,
    drift: 80,
    tilt: -4,
    depth: "near",
  },
  {
    label: "Plan Tuesday",
    meta: "#personal",
    x: 62,
    delay: -10,
    duration: 19,
    drift: -40,
    tilt: 2,
    depth: "mid",
  },
  {
    label: "Call Mom",
    meta: "6:00",
    x: 75,
    delay: -2,
    duration: 15,
    drift: 55,
    tilt: -2,
    depth: "near",
  },
  {
    label: "Fix export flow",
    meta: "#release",
    x: 88,
    delay: -13,
    duration: 21,
    drift: -90,
    tilt: 3,
    depth: "far",
  },
  {
    label: "Read Ursula",
    meta: "#someday",
    x: 8,
    delay: -18,
    duration: 23,
    drift: 120,
    tilt: 2,
    depth: "far",
  },
  {
    label: "Pay electric",
    meta: "Friday",
    x: 20,
    delay: -1,
    duration: 14,
    drift: -35,
    tilt: -3,
    depth: "near",
  },
  {
    label: "Recurring metrics",
    meta: "#work",
    x: 33,
    delay: -9,
    duration: 18,
    drift: 65,
    tilt: 4,
    depth: "mid",
  },
  {
    label: "Ship v0.5",
    meta: "P1",
    x: 46,
    delay: -20,
    duration: 24,
    drift: -85,
    tilt: -2,
    depth: "far",
  },
  {
    label: "Pick up film",
    meta: "#errands",
    x: 58,
    delay: -14,
    duration: 20,
    drift: 105,
    tilt: 3,
    depth: "mid",
  },
  {
    label: "Sketch new flow",
    meta: "#idea",
    x: 70,
    delay: -6,
    duration: 17,
    drift: -55,
    tilt: -4,
    depth: "near",
  },
  {
    label: "Pack for Portland",
    meta: "Saturday",
    x: 82,
    delay: -17,
    duration: 22,
    drift: 75,
    tilt: 1,
    depth: "far",
  },
  {
    label: "Update the docs",
    meta: "#launch",
    x: 94,
    delay: -8,
    duration: 19,
    drift: -120,
    tilt: -2,
    depth: "mid",
  },
] as const;

const VIEW_MODES = [
  {
    id: "list",
    label: "List",
    summary: "A clean line through what comes next.",
  },
  {
    id: "swimlanes",
    label: "Swimlanes",
    summary: "Move work by state without moving the data.",
  },
  {
    id: "tags",
    label: "Tags",
    summary: "See the themes hiding across every list.",
  },
] as const;

type ViewMode = (typeof VIEW_MODES)[number]["id"];

const VIEW_TASKS = [
  { title: "Review sync security", tag: "privacy", priority: "P2" },
  { title: "Send launch notes", tag: "release", priority: "P1" },
  { title: "Plan the week", tag: "personal", priority: "P3" },
  { title: "Update the docs", tag: "release", priority: "P2" },
] as const;

const WORKSPACES = [
  {
    id: "personal",
    name: "Personal",
    initial: "P",
    accent: "celadon",
    count: 7,
    tasks: ["Book the dentist", "Pack for Portland", "Water the basil"],
  },
  {
    id: "studio",
    name: "Studio",
    initial: "S",
    accent: "apricot",
    count: 12,
    tasks: ["Review client cut", "Send launch brief", "Invoice Northstar"],
  },
  {
    id: "routines",
    name: "Routines",
    initial: "R",
    accent: "blue",
    count: 5,
    tasks: ["Weekly planning", "Recurring metrics", "Back up archive"],
  },
] as const;

type WorkspaceId = (typeof WORKSPACES)[number]["id"];

export function LandingExperience({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="landing-page">
      <main>
        <section className="landing-hero">
          <TaskRain />
          <div className="landing-hero-haze" aria-hidden="true" />

          <div className="landing-frame landing-hero-layout">
            <div className="landing-hero-copy">
              <a
                href={`${REPO_URL}/releases/tag/app-v${desktopConfig.version}`}
                target="_blank"
                rel="noreferrer"
                className="landing-release"
              >
                <span className="landing-release-pulse" aria-hidden="true" />
                v{desktopConfig.version}
                <span aria-hidden="true">/</span>
                encrypted sync
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>

              <p className="landing-kicker">A quiet place for loud days.</p>
              <h1 className="landing-hero-title">
                Let it all
                <span>land.</span>
              </h1>
              <p className="landing-hero-lede">
                Catch the stray thought, deadline, and{" "}
                <span className="landing-inline-tag">#someday</span>. Dahoko
                turns the downpour into a calm plan—locally, privately, in
                whatever view fits.
              </p>

              <div className="landing-actions">
                <Button
                  size="lg"
                  asChild
                  className="landing-primary-action min-h-12 px-6"
                >
                  <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Download for desktop
                  </a>
                </Button>
                <InternalLink
                  href="/docs/getting-started"
                  onNavigate={onNavigate}
                  className="landing-text-action"
                >
                  See how it works
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </InternalLink>
              </div>

              <div className="landing-trust" aria-label="Product details">
                <span>macOS · Windows · Linux</span>
                <span>MIT licensed</span>
                <span>No account required</span>
              </div>
            </div>

            <CaptureScene />
          </div>

          <div className="landing-frame landing-forecast">
            <span>Today’s forecast</span>
            <strong>100% chance you remember it</strong>
            <span className="landing-forecast-line" aria-hidden="true" />
            <small>Everything is captured locally first.</small>
          </div>
        </section>

        <ViewStory />

        <section className="landing-privacy">
          <div className="landing-frame landing-privacy-layout">
            <div className="landing-section-copy">
              <p className="landing-kicker">Private by construction</p>
              <h2>
                The cloud can carry it.{" "}
                <br />
                It cannot read it.
              </h2>
              <p>
                Your readable SQLite database stays on your device. Sync seals
                each workspace before it leaves, so the server only ever sees
                ciphertext.
              </p>
              <div className="landing-copy-actions">
                <InternalLink
                  href="/docs/encrypted-sync"
                  onNavigate={onNavigate}
                >
                  Read the security model
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </InternalLink>
                <InternalLink href="/docs/self-hosting" onNavigate={onNavigate}>
                  Self-host sync
                </InternalLink>
              </div>
            </div>
            <PrivacyPath />
          </div>
        </section>

        <WorkspaceStory onNavigate={onNavigate} />

        <section className="landing-final">
          <div className="landing-frame landing-final-layout">
            <div>
              <p className="landing-kicker">The quiet after the downpour</p>
              <h2>A clearer day starts with one line.</h2>
            </div>
            <div className="landing-final-action">
              <p>
                Open a workspace and start typing. No signup wall, migration
                ceremony, or cloud database required.
              </p>
              <div className="landing-final-buttons">
                <Button
                  size="lg"
                  asChild
                  className="landing-primary-action min-h-12 px-6"
                >
                  <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Download Dahoko
                  </a>
                </Button>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="landing-star-action"
                >
                  <Star aria-hidden="true" className="h-4 w-4" />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-frame landing-footer-layout">
          <div className="landing-footer-brand">
            <span aria-hidden="true">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div>
              <strong>dahoko</strong>
              <small>Private task management, built in the open.</small>
            </div>
          </div>
          <nav aria-label="Footer" className="landing-footer-links">
            <InternalLink
              href="/docs/getting-started"
              onNavigate={onNavigate}
            >
              Documentation
            </InternalLink>
            <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer">
              Releases
            </a>
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
            >
              MIT License
            </a>
            <span>© {new Date().getFullYear()} contributors</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function TaskRain() {
  return (
    <div className="task-rain" aria-hidden="true">
      {RAIN_TASKS.map((task) => {
        const style: CustomProperties = {
          "--rain-x": `${task.x}%`,
          "--rain-delay": `${task.delay}s`,
          "--rain-duration": `${task.duration}s`,
          "--rain-drift": `${task.drift}px`,
          "--rain-tilt": `${task.tilt}deg`,
        };
        return (
          <span
            key={task.label}
            className={`task-rain-item task-rain-${task.depth}`}
            style={style}
          >
            <span className="task-rain-check" />
            <span>{task.label}</span>
            <small>{task.meta}</small>
          </span>
        );
      })}
    </div>
  );
}

function CaptureScene() {
  const tasks = [
    { title: "Send launch notes", detail: "#release", tone: "apricot" },
    { title: "Review sync security", detail: "#privacy", tone: "celadon" },
    { title: "Plan the week", detail: "#personal", tone: "blue" },
  ] as const;

  return (
    <div className="capture-scene" aria-label="Dahoko quick capture preview">
      <div className="capture-window">
        <div className="capture-titlebar">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <small>Dahoko · Personal</small>
          <strong>Local</strong>
        </div>
        <div className="capture-body">
          <aside className="capture-sidebar">
            <div className="capture-workspace">
              <span>P</span>
              <div>
                <small>Workspace</small>
                <strong>Personal</strong>
              </div>
            </div>
            <p className="is-active">Inbox <span>3</span></p>
            <p>Today <span>1</span></p>
            <p>Completed</p>
            <small className="capture-sidebar-label">Lists</small>
            <p>Launch</p>
            <p>Personal</p>
          </aside>

          <div className="capture-content">
            <div className="capture-heading">
              <div>
                <small>Monday, July 27</small>
                <strong>Inbox</strong>
              </div>
              <span>3 caught</span>
            </div>
            <div className="capture-input">
              <span aria-hidden="true">+</span>
              <div className="capture-command">
                Draft launch notes tomorrow #release !1
              </div>
              <kbd>Enter</kbd>
            </div>
            <div className="capture-parse">
              <span>Tomorrow</span>
              <span>#release</span>
              <span>P1</span>
              <small>understood</small>
            </div>
            <div className="capture-task-list">
              {tasks.map((task, index) => (
                <div className="capture-task" key={task.title}>
                  <span
                    className={`capture-task-dot is-${task.tone}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.detail}</small>
                  </div>
                  <time>{index === 2 ? "Fri" : "Today"}</time>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="capture-local-note">
        <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
        Written to your device first
      </div>
    </div>
  );
}

function ViewStory() {
  const [mode, setMode] = useState<ViewMode>("list");
  const [cycleRevision, setCycleRevision] = useState(0);
  const activeIndex = VIEW_MODES.findIndex((item) => item.id === mode);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setMode((current) => {
        const index = VIEW_MODES.findIndex((item) => item.id === current);
        return VIEW_MODES[(index + 1) % VIEW_MODES.length].id;
      });
    }, 5200);
    return () => window.clearInterval(interval);
  }, [cycleRevision]);

  const selectMode = (nextMode: ViewMode) => {
    setMode(nextMode);
    setCycleRevision((current) => current + 1);
  };

  return (
    <section className="landing-views">
      <div className="landing-frame">
        <div className="landing-views-heading">
          <p className="landing-kicker">One database, several angles</p>
          <h2>Change the view. Keep the truth.</h2>
          <p>
            The same tasks can answer different questions without copies,
            migrations, or a weekend spent reorganizing your system.
          </p>
        </div>

        <div className="view-story">
          <div className="view-mode-list" aria-label="Preview a Dahoko view">
            {VIEW_MODES.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === mode}
                onClick={() => selectMode(item.id)}
                className={item.id === mode ? "is-active" : undefined}
              >
                <span className="view-mode-number">0{index + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.summary}</small>
                </span>
                {item.id === mode ? (
                  <span
                    key={`${mode}-${activeIndex}`}
                    className="view-mode-progress"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            ))}
          </div>
          <ViewScene mode={mode} />
        </div>
      </div>
    </section>
  );
}

function ViewScene({ mode }: { mode: ViewMode }) {
  const active = VIEW_MODES.find((item) => item.id === mode)!;
  const Icon =
    mode === "list" ? ListChecks : mode === "swimlanes" ? Columns3 : Hash;

  return (
    <div className="view-window">
      <div className="view-window-titlebar">
        <div>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
        <small>Personal / Today</small>
        <span className="view-window-sync">Saved locally</span>
      </div>
      <div className="view-scene-heading">
        <span>
          <Icon aria-hidden="true" className="h-4 w-4" />
          {active.label}
        </span>
        <small aria-live="polite">{active.summary}</small>
      </div>
      <div className="view-scene" key={mode}>
        {mode === "list" ? <ListScene /> : null}
        {mode === "swimlanes" ? <SwimlaneScene /> : null}
        {mode === "tags" ? <TagScene /> : null}
      </div>
    </div>
  );
}

function ListScene() {
  return (
    <div className="view-list-scene">
      {VIEW_TASKS.map((task, index) => (
        <div key={task.title}>
          <span className={index === 0 ? "is-today" : undefined} />
          <strong>{task.title}</strong>
          <small>#{task.tag}</small>
          <em>{task.priority}</em>
        </div>
      ))}
    </div>
  );
}

function SwimlaneScene() {
  const lanes = [
    { label: "Today", tasks: [VIEW_TASKS[0], VIEW_TASKS[1]] },
    { label: "Next", tasks: [VIEW_TASKS[2]] },
    { label: "Waiting", tasks: [VIEW_TASKS[3]] },
  ];
  return (
    <div className="view-lane-scene">
      {lanes.map((lane) => (
        <div className="view-lane" key={lane.label}>
          <p>
            {lane.label}
            <span>{lane.tasks.length}</span>
          </p>
          {lane.tasks.map((task) => (
            <div className="view-lane-task" key={task.title}>
              <strong>{task.title}</strong>
              <span>#{task.tag}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TagScene() {
  const groups = [
    { tag: "privacy", tasks: [VIEW_TASKS[0]] },
    { tag: "release", tasks: [VIEW_TASKS[1], VIEW_TASKS[3]] },
    { tag: "personal", tasks: [VIEW_TASKS[2]] },
  ];
  return (
    <div className="view-tag-scene">
      {groups.map((group) => (
        <div key={group.tag}>
          <p>
            <span>#</span>
            {group.tag}
            <small>{group.tasks.length}</small>
          </p>
          <section>
            {group.tasks.map((task) => (
              <span key={task.title}>{task.title}</span>
            ))}
          </section>
        </div>
      ))}
    </div>
  );
}

function PrivacyPath() {
  return (
    <div className="privacy-path" aria-label="Encrypted sync data path">
      <div className="privacy-path-grid" aria-hidden="true" />
      <div className="privacy-node privacy-node-local">
        <span>
          <Laptop className="h-5 w-5" />
        </span>
        <strong>Your device</strong>
        <small>Readable SQLite</small>
      </div>
      <div className="privacy-rail" aria-hidden="true">
        <span className="privacy-rail-line" />
        <span className="privacy-packet">
          <LockKeyhole className="h-3.5 w-3.5" />
          AES-256-GCM
        </span>
      </div>
      <div className="privacy-node privacy-node-server">
        <span>
          <Server className="h-5 w-5" />
        </span>
        <strong>Sync server</strong>
        <small>
          <EyeOff className="h-3 w-3" />
          Ciphertext only
        </small>
      </div>
      <div className="privacy-path-caption">
        <span>
          <strong>01</strong>
          Write locally
        </span>
        <span>
          <strong>02</strong>
          Seal before upload
        </span>
        <span>
          <strong>03</strong>
          Sync without visibility
        </span>
      </div>
    </div>
  );
}

function WorkspaceStory({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [workspaceId, setWorkspaceId] =
    useState<WorkspaceId>("personal");
  const workspace = useMemo(
    () => WORKSPACES.find((item) => item.id === workspaceId)!,
    [workspaceId],
  );

  return (
    <section className="landing-workspaces">
      <div className="landing-frame landing-workspace-layout">
        <div className="workspace-switcher">
          <div className="workspace-switcher-titlebar">
            <span>Switch workspace</span>
            <small>{WORKSPACES.length} separate spaces</small>
          </div>
          <div className="workspace-tabs" aria-label="Preview a workspace">
            {WORKSPACES.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === workspaceId}
                className={item.id === workspaceId ? "is-active" : undefined}
                onClick={() => setWorkspaceId(item.id)}
              >
                <span className={`is-${item.accent}`}>{item.initial}</span>
                {item.name}
                <small>{item.count}</small>
              </button>
            ))}
          </div>
          <div
            className={`workspace-panel is-${workspace.accent}`}
            key={workspace.id}
          >
            <div>
              <span>{workspace.initial}</span>
              <div>
                <small>Current workspace</small>
                <strong>{workspace.name}</strong>
              </div>
            </div>
            <section>
              {workspace.tasks.map((task, index) => (
                <p key={task}>
                  <span aria-hidden="true" />
                  {task}
                  <small>{index === 0 ? "Today" : "Later"}</small>
                </p>
              ))}
            </section>
          </div>
        </div>

        <div className="landing-section-copy">
          <p className="landing-kicker">Boundaries without friction</p>
          <h2>
            Same app.{" "}
            <br />
            Separate rooms.
          </h2>
          <p>
            Personal plans do not need to sit beside client deadlines.
            Workspaces keep tasks, views, and sync boundaries distinct, then
            switch context in one click.
          </p>
          <InternalLink
            href="/docs/workspaces"
            onNavigate={onNavigate}
            className="landing-inline-link"
          >
            Explore workspaces
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </InternalLink>
        </div>
      </div>
    </section>
  );
}
