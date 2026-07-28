import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Columns3,
  Download,
  Github,
  Inbox,
  Keyboard,
  ListChecks,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import {
  Button,
  ThemeToggle,
  TooltipProvider,
  VersionBadge,
} from "@dahoko/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import desktopConfig from "../../desktop/src-tauri/tauri.conf.json";
import {
  DOC_PAGE_BY_SLUG,
  DOC_PAGES,
  FEATURE_HIGHLIGHTS,
  isDocSlug,
} from "./content";
import {
  DocsLayout,
  DocsSearchDialog,
  InternalLink,
} from "./docs";
import { LandingExperience } from "./landing";

const REPO_URL = "https://github.com/megancooper/dahoko";
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function getPageTitle(pathname: string) {
  if (!pathname.startsWith("/docs")) {
    return "dahoko — private, local-first task management";
  }
  const slug = pathname.split("/")[2] || "getting-started";
  const page = isDocSlug(slug) ? DOC_PAGE_BY_SLUG.get(slug) : undefined;
  return `${page?.title ?? "Documentation"} — dahoko docs`;
}

export function App() {
  const [pathname, setPathname] = useState(() =>
    normalizePathname(window.location.pathname),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useCallback((path: string) => {
    const normalized = normalizePathname(path);
    if (normalized !== normalizePathname(window.location.pathname)) {
      window.history.pushState({}, "", normalized);
    }
    setPathname(normalized);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const handlePopState = () =>
      setPathname(normalizePathname(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = getPageTitle(pathname);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isDocs = pathname === "/docs" || pathname.startsWith("/docs/");
  const selectedDoc = useMemo(() => {
    const slug = pathname.split("/")[2] || "getting-started";
    return isDocSlug(slug)
      ? DOC_PAGE_BY_SLUG.get(slug)
      : DOC_PAGE_BY_SLUG.get("getting-started");
  }, [pathname]);

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <SiteHeader
          isDocs={isDocs}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuChange={setMobileMenuOpen}
          onNavigate={navigate}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {isDocs && selectedDoc ? (
          <>
            <MobileDocsNav
              activeSlug={selectedDoc.slug}
              onNavigate={navigate}
            />
            <DocsLayout
              page={selectedDoc}
              onNavigate={navigate}
              onOpenSearch={() => setSearchOpen(true)}
            />
          </>
        ) : (
          <LandingExperience onNavigate={navigate} />
        )}

        <DocsSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onNavigate={navigate}
        />
      </div>
    </TooltipProvider>
  );
}

function SiteHeader({
  isDocs,
  mobileMenuOpen,
  onMobileMenuChange,
  onNavigate,
  onOpenSearch,
}: {
  isDocs: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div
        className={`mx-auto flex h-16 w-full items-center gap-4 ${
          isDocs
            ? "max-w-[1500px] px-4 sm:px-6"
            : "landing-header-frame"
        }`}
      >
        <InternalLink
          href="/"
          onNavigate={onNavigate}
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-[10px] border border-primary-strong/25 bg-primary text-primary-foreground ${
              isDocs
                ? "shadow-[0_5px_15px_-7px_rgb(var(--brand-primary-depth)/0.65)]"
                : "landing-header-mark"
            }`}
          >
            <Check aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={3} />
          </span>
          <span className="font-brand text-[17px] font-bold tracking-[-0.025em]">
            dahoko
          </span>
          <VersionBadge version={desktopConfig.version} />
        </InternalLink>

        <nav
          aria-label="Primary"
          className="ml-4 hidden items-center gap-1 md:flex"
        >
          <InternalLink
            href="/docs/getting-started"
            onNavigate={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isDocs
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            Docs
          </InternalLink>
          <a
            href={`${REPO_URL}/releases`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            Releases
          </a>
          <a
            href={`${REPO_URL}#self-hosted-encrypted-sync`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            Self-host
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {isDocs ? (
            <button
              type="button"
              onClick={onOpenSearch}
              className="mr-1 hidden h-9 w-52 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-xs text-muted-foreground shadow-sm transition-[border-color,background-color,color] hover:border-primary-strong/35 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              Search docs
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px]">
                ⌘K
              </kbd>
            </button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github aria-hidden="true" className="h-4 w-4" />
              GitHub
            </a>
          </Button>
          <ThemeToggle />
          <Button
            size="sm"
            asChild
            className="hidden min-h-9 md:inline-flex"
          >
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" className="h-4 w-4" />
              Download
            </a>
          </Button>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => onMobileMenuChange(!mobileMenuOpen)}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-border bg-background px-4 py-4 md:hidden"
        >
          <div
            className={`mx-auto grid gap-1 ${
              isDocs ? "max-w-[1500px]" : "max-w-[1180px]"
            }`}
          >
            <InternalLink
              href="/docs/getting-started"
              onNavigate={onNavigate}
              className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted"
            >
              Documentation
            </InternalLink>
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted"
            >
              Releases
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-muted"
            >
              GitHub
            </a>
            <Button asChild className="mt-2 w-full">
              <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" className="h-4 w-4" />
                Download for desktop
              </a>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function MobileDocsNav({
  activeSlug,
  onNavigate,
}: {
  activeSlug: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav
      aria-label="Documentation sections"
      className="docs-mobile-nav border-b border-border bg-background lg:hidden"
    >
      <div className="flex gap-1 overflow-x-auto px-4 py-2">
        {DOC_PAGES.map((page) => (
          <InternalLink
            key={page.slug}
            href={`/docs/${page.slug}`}
            onNavigate={onNavigate}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              page.slug === activeSlug
                ? "bg-primary/25 text-primary-strong"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {page.title}
          </InternalLink>
        ))}
      </div>
    </nav>
  );
}

export function LegacyLandingPage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  return (
    <>
      <main className="overflow-hidden">
        <section className="relative border-b border-border/70">
          <div
            aria-hidden="true"
            className="hero-grid absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_86%)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[-260px] h-[600px] w-[850px] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
          />
          <div className="container relative grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:pb-28 lg:pt-24">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
              <a
                href={`${REPO_URL}/releases/tag/app-v${desktopConfig.version}`}
                target="_blank"
                rel="noreferrer"
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-strong/20 bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary/30"
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Dahoko {desktopConfig.version} · encrypted sync is here
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
              <h1 className="font-brand text-[clamp(3rem,7vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.055em]">
                Your work.
                <br />
                <span className="text-primary-strong">In your hands.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground lg:mx-0">
                A private, local-first task manager with fluid views, isolated
                workspaces, and optional end-to-end encrypted sync.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <Button size="lg" asChild className="min-h-12 px-6">
                  <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Download for desktop
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  asChild
                  className="min-h-12 px-6"
                >
                  <InternalLink
                    href="/docs/getting-started"
                    onNavigate={onNavigate}
                  >
                    Read the docs
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </InternalLink>
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />
                  macOS, Windows & Linux
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />
                  MIT licensed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />
                  No account required
                </span>
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section className="container py-24 sm:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary-strong">
              One database, many perspectives
            </p>
            <h2 className="font-brand text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              A calmer way to see what matters
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Dahoko keeps capture simple, organization flexible, and data
              ownership explicit.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {FEATURE_HIGHLIGHTS.map((feature, index) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary-strong/30 hover:shadow-soft motion-reduce:hover:translate-y-0"
              >
                <span className="absolute right-5 top-4 font-mono text-5xl font-bold text-muted/60">
                  0{index + 1}
                </span>
                <div className="mb-10 grid h-11 w-11 place-items-center rounded-xl border border-primary-strong/20 bg-primary/20 text-primary-strong">
                  <feature.icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/35">
          <div className="container grid items-center gap-14 py-24 lg:grid-cols-2 lg:py-28">
            <div className="max-w-xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary-strong">
                Privacy that is easy to explain
              </p>
              <h2 className="font-brand text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                Local by default.
                <br />
                Encrypted when connected.
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Your readable task database lives on your device. When you turn
                on sync, Dahoko encrypts every workspace before upload. The
                server only stores ciphertext.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button variant="secondary" asChild>
                  <InternalLink
                    href="/docs/encrypted-sync"
                    onNavigate={onNavigate}
                  >
                    How sync protects data
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </InternalLink>
                </Button>
                <Button variant="tertiary" asChild>
                  <InternalLink
                    href="/docs/self-hosting"
                    onNavigate={onNavigate}
                  >
                    Self-host the server
                  </InternalLink>
                </Button>
              </div>
            </div>
            <PrivacyDiagram />
          </div>
        </section>

        <section className="container py-24 sm:py-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-primary-strong/20 bg-[#17456f] px-6 py-14 text-center text-white shadow-[0_28px_80px_-38px_rgb(var(--brand-primary-depth)/0.8)] dark:bg-[#102b45] sm:px-12">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(163,208,255,0.28),transparent_42%)]"
            />
            <div className="relative">
              <span className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10">
                <ListChecks aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="font-brand text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                Your next task can stay yours.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-blue-100/80">
                Download Dahoko, open a local workspace, and start working. No
                signup wall and no cloud database required.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="min-h-12">
                  <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Download Dahoko
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="min-h-12 border-white/25 bg-white/10 text-white hover:bg-white/15"
                >
                  <a href={REPO_URL} target="_blank" rel="noreferrer">
                    <Star aria-hidden="true" className="h-4 w-4" />
                    Star on GitHub
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            </span>
            <div>
              <p className="text-sm font-bold">dahoko</p>
              <p className="text-xs text-muted-foreground">
                Private task management, built in the open.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <InternalLink
              href="/docs/getting-started"
              onNavigate={onNavigate}
              className="hover:text-foreground"
            >
              Documentation
            </InternalLink>
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Releases
            </a>
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              MIT License
            </a>
            <span>© {new Date().getFullYear()} contributors</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function ProductPreview() {
  const tasks = [
    { title: "Finalize launch notes", tag: "release", priority: "P1" },
    { title: "Review sync security model", tag: "privacy", priority: "P2" },
    { title: "Plan the week", tag: "personal", priority: "P3" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[720px] lg:mx-0">
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[40px] bg-primary/25 blur-3xl"
      />
      <div className="app-preview relative overflow-hidden rounded-[22px] border border-border/90 bg-card shadow-[0_36px_100px_-46px_rgb(var(--brand-primary-depth)/0.65)]">
        <div className="flex h-10 items-center border-b border-border bg-muted/55 px-4">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b65]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f6bf4f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#55c778]" />
          </div>
          <span className="mx-auto -translate-x-5 text-[10px] font-medium text-muted-foreground">
            Dahoko · Personal
          </span>
        </div>
        <div className="grid min-h-[390px] grid-cols-[146px_minmax(0,1fr)] sm:grid-cols-[184px_minmax(0,1fr)]">
          <div className="border-r border-border bg-muted/25 p-3">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/40 text-xs font-bold text-primary-strong">
                P
              </span>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Workspace
                </p>
                <p className="truncate text-xs font-semibold">Personal</p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="ml-auto hidden h-3 w-3 text-muted-foreground sm:block"
              />
            </div>
            <PreviewNavItem icon={Inbox} label="Inbox" active count={3} />
            <PreviewNavItem icon={CalendarDays} label="Today" count={1} />
            <PreviewNavItem icon={Check} label="Completed" />
            <p className="mb-1 mt-5 px-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lists
            </p>
            <PreviewNavItem icon={Circle} label="Launch" />
            <PreviewNavItem icon={Circle} label="Personal" />
          </div>
          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-strong">
                  Monday, July 27
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Inbox</h2>
              </div>
              <div className="flex rounded-lg border border-border bg-muted/55 p-0.5">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-card text-primary-strong shadow-sm">
                  <ListChecks aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <span className="grid h-7 w-7 place-items-center text-muted-foreground">
                  <Columns3 aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
            <div className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-primary-strong/25 bg-primary/10 px-3 text-xs text-muted-foreground shadow-sm">
              <span className="text-base text-primary-strong">+</span>
              Add a task, date, #tag, or !priority
              <span className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[8px] sm:inline">
                Enter
              </span>
            </div>
            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div
                  key={task.title}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 shadow-[0_2px_8px_-5px_rgb(var(--brand-primary-depth)/0.3)]"
                >
                  <span
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                      index === 0
                        ? "border-primary-strong bg-primary/30"
                        : "border-border-strong/35"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{task.title}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[8px] font-medium text-secondary-foreground">
                        #{task.tag}
                      </span>
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground">
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <span className="mt-0.5 hidden text-[9px] text-muted-foreground sm:block">
                    Today
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -right-2 hidden items-center gap-2 rounded-xl border border-primary-strong/20 bg-card px-3 py-2 shadow-soft sm:flex">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/25 text-primary-strong">
          <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
        <span>
          <strong className="block text-[10px]">End-to-end encrypted</strong>
          <small className="block text-[9px] text-muted-foreground">
            Synced just now
          </small>
        </span>
      </div>
    </div>
  );
}

function PreviewNavItem({
  icon: Icon,
  label,
  active = false,
  count,
}: {
  icon: typeof Inbox;
  label: string;
  active?: boolean;
  count?: number;
}) {
  return (
    <div
      className={`mb-0.5 flex h-8 items-center gap-2 rounded-lg px-2 text-[10px] font-medium ${
        active
          ? "bg-primary/25 text-primary-strong"
          : "text-muted-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
      {count ? <span className="ml-auto tabular-nums">{count}</span> : null}
    </div>
  );
}

function PrivacyDiagram() {
  const steps = [
    {
      icon: Keyboard,
      title: "Write locally",
      body: "Tasks are stored in SQLite on your device.",
    },
    {
      icon: ShieldCheck,
      title: "Encrypt locally",
      body: "Your passphrase derives a key that never reaches the server.",
    },
    {
      icon: LockKeyhole,
      title: "Sync ciphertext",
      body: "Only the encrypted workspace bundle is uploaded.",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-strong">
            Data path
          </p>
          <p className="mt-1 text-sm font-bold">Readable data stays with you</p>
        </div>
        <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
          Zero knowledge
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative flex items-center gap-4 rounded-xl border border-border/80 bg-background p-4"
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[33px] top-[52px] h-6 w-px bg-border"
              />
            ) : null}
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/25 text-primary-strong">
              <step.icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {step.body}
              </p>
            </div>
            <Check
              aria-hidden="true"
              className="ml-auto h-4 w-4 shrink-0 text-success"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
