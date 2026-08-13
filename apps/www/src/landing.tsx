import {
  ArrowRight,
  Check,
  Cloud,
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
import { Button, cn } from "@dahoko/ui";
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
  { title: "Send launch notes", tag: "release", priority: "P1", due: "Today" },
  { title: "Review sync security", tag: "privacy", priority: "P2", due: "Today" },
  { title: "Fix export flow", tag: "release", priority: "P1", due: "Thu" },
  { title: "Update the docs", tag: "release", priority: "P2", due: "Fri" },
  { title: "Plan the week", tag: "personal", priority: "P3", due: "Fri" },
  { title: "Book the dentist", tag: "personal", priority: "P3", due: "Sat" },
] as const;

const WORKSPACES = [
  {
    id: "personal",
    name: "Personal",
    initial: "P",
    accent: "celadon",
    count: 7,
    tasks: [
      "Book the dentist",
      "Pack for Portland",
      "Water the basil",
      "Renew passport",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    initial: "S",
    accent: "apricot",
    count: 12,
    tasks: [
      "Review client cut",
      "Send launch brief",
      "Invoice Northstar",
      "Book color grade",
    ],
  },
  {
    id: "routines",
    name: "Routines",
    initial: "R",
    accent: "blue",
    count: 5,
    tasks: [
      "Weekly planning",
      "Recurring metrics",
      "Back up archive",
      "Clear the inbox",
    ],
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
      <CheckoutSuccessBanner />
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

        <CloudPricing onNavigate={onNavigate} />

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
            <a href="/#cloud">Pricing</a>
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
      <div className="landing-frame flex items-start gap-3">
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

function CloudPricing({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const price = PRICING[interval];

  return (
    <section id="cloud" className="landing-cloud border-t border-border/70">
      <div className="landing-frame py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="landing-kicker">Dahoko Cloud</p>
          <h2>
            Free where you work.
            <br />
            Paid only where we do.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The app is free and complete — no feature gates, no task limits.
            Pro pays for the one thing that costs us money: running the
            encrypted sync servers so you don’t have to.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted text-foreground">
                <Laptop aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Free</h3>
                <p className="text-xs text-muted-foreground">
                  Local-first, yours forever
                </p>
              </div>
            </div>
            <p className="mb-5">
              <span className="font-brand text-4xl font-bold tracking-tight">
                $0
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                no account required
              </span>
            </p>
            <ul className="mb-7 space-y-2.5 text-sm leading-6">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check
                    aria-hidden="true"
                    className="mt-1 h-4 w-4 flex-shrink-0 text-success"
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="mt-auto min-h-12"
            >
              <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" className="h-4 w-4" />
                Download free
              </a>
            </Button>
          </article>

          <article className="relative flex flex-col rounded-2xl border border-primary-strong/35 bg-card p-7 shadow-[0_24px_60px_-30px_rgb(var(--brand-primary-depth)/0.55)]">
            <span className="absolute -top-3 right-6 rounded-full border border-primary-strong/25 bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
              Pro
            </span>
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary-strong/25 bg-primary/20 text-primary-strong">
                <Cloud aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold tracking-tight">
                  Dahoko Cloud
                </h3>
                <p className="text-xs text-muted-foreground">
                  Hosted encrypted sync
                </p>
              </div>
            </div>

            <div className="mb-5 flex items-end justify-between gap-3">
              <p>
                <span className="font-brand text-4xl font-bold tracking-tight">
                  {price.label}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {price.cadence}
                </span>
              </p>
              <div
                role="group"
                aria-label="Billing interval"
                className="flex rounded-lg border border-border bg-muted/55 p-0.5 text-xs font-semibold"
              >
                {(["monthly", "yearly"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={interval === option}
                    onClick={() => setInterval(option)}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-colors",
                      interval === option
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mb-5 space-y-2.5 text-sm leading-6">
              <li className="flex gap-2.5 font-semibold">
                <Check
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 flex-shrink-0 text-success"
                />
                Everything in Free, plus
              </li>
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check
                    aria-hidden="true"
                    className="mt-1 h-4 w-4 flex-shrink-0 text-success"
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mb-6 flex items-start gap-2 rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs leading-5 text-muted-foreground">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
              />
              Cancel anytime. Your data is end-to-end encrypted and stays
              downloadable even after a subscription lapses — never hostage.
            </p>
            <Button size="lg" asChild className="mt-auto min-h-12">
              <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                <Cloud aria-hidden="true" className="h-4 w-4" />
                Get the app, upgrade inside
              </a>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Checkout opens from Settings → Sync — powered by Stripe.{" "}
              <InternalLink
                href="/docs/encrypted-sync"
                onNavigate={onNavigate}
                className="underline underline-offset-2 hover:text-foreground"
              >
                How encryption works
              </InternalLink>
            </p>
          </article>
        </div>
      </div>
    </section>
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
    { title: "Send launch notes", detail: "#release", tone: "apricot", when: "Today" },
    { title: "Review sync security", detail: "#privacy", tone: "celadon", when: "Today" },
    { title: "Water the basil", detail: "#home", tone: "celadon", when: "Thu" },
    { title: "Plan the week", detail: "#personal", tone: "blue", when: "Fri" },
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
            <p className="is-active">Inbox <span>4</span></p>
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
              <span>4 caught</span>
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
              {tasks.map((task) => (
                <div className="capture-task" key={task.title}>
                  <span
                    className={`capture-task-dot is-${task.tone}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.detail}</small>
                  </div>
                  <time>{task.when}</time>
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
      {VIEW_TASKS.map((task) => (
        <div key={task.title}>
          <span className={task.due === "Today" ? "is-today" : undefined} />
          <strong>{task.title}</strong>
          <small>#{task.tag}</small>
          <em>{task.priority}</em>
          <time>{task.due}</time>
        </div>
      ))}
      <div className="is-done">
        <span className="is-checked" />
        <strong>Water the basil</strong>
        <small>#home</small>
        <time>Done</time>
      </div>
    </div>
  );
}

function SwimlaneScene() {
  const lanes = [
    {
      label: "Today",
      tasks: [VIEW_TASKS[0], VIEW_TASKS[1], VIEW_TASKS[2]],
    },
    { label: "Next", tasks: [VIEW_TASKS[3], VIEW_TASKS[4]] },
    { label: "Waiting", tasks: [VIEW_TASKS[5]] },
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
              <span>
                #{task.tag}
                <time>{task.due}</time>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TagScene() {
  const groups = [
    {
      tag: "release",
      accent: "apricot",
      tasks: [VIEW_TASKS[0], VIEW_TASKS[2], VIEW_TASKS[3]],
    },
    {
      tag: "personal",
      accent: "blue",
      tasks: [VIEW_TASKS[4], VIEW_TASKS[5]],
    },
    { tag: "privacy", accent: "celadon", tasks: [VIEW_TASKS[1]] },
  ];
  return (
    <div className="view-tag-scene">
      {groups.map((group) => (
        <section key={group.tag} className={`is-${group.accent}`}>
          <p>
            <span>#</span>
            {group.tag}
            <small>{group.tasks.length}</small>
          </p>
          {group.tasks.map((task) => (
            <div key={task.title}>
              <span aria-hidden="true" />
              <strong>{task.title}</strong>
              <em>{task.priority}</em>
              <time>{task.due}</time>
            </div>
          ))}
        </section>
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
                  <small>
                    {["Today", "Tomorrow", "Thu", "Later"][index]}
                  </small>
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
