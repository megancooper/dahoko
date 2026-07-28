import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Columns3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson,
  HardDrive,
  Info,
  KeyRound,
  LockKeyhole,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Tags,
  Terminal,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@dahoko/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DOC_GROUPS,
  DOC_PAGES,
  type DocPage,
  type DocSlug,
} from "./content";

const REPO_URL = "https://github.com/megancooper/dahoko";

interface InternalLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate: (path: string) => void;
}

export function InternalLink({
  href,
  className,
  children,
  onNavigate,
}: InternalLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}

interface DocsLayoutProps {
  page: DocPage;
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
}

export function DocsLayout({
  page,
  onNavigate,
  onOpenSearch,
}: DocsLayoutProps) {
  const pageIndex = DOC_PAGES.findIndex((candidate) => candidate.slug === page.slug);
  const previous = pageIndex > 0 ? DOC_PAGES[pageIndex - 1] : undefined;
  const next =
    pageIndex < DOC_PAGES.length - 1 ? DOC_PAGES[pageIndex + 1] : undefined;

  return (
    <div className="docs-shell mx-auto grid w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,760px)_220px]">
      <aside className="hidden border-r border-border/70 px-5 pb-16 pt-8 lg:block">
        <div className="sticky top-[76px] max-h-[calc(100dvh-96px)] overflow-y-auto pr-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="mb-7 flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition-[border-color,background-color,color,box-shadow] duration-150 hover:border-primary-strong/40 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">Search docs</span>
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <nav aria-label="Documentation">
            {DOC_GROUPS.map((group) => (
              <div key={group} className="mb-7">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {DOC_PAGES.filter((candidate) => candidate.group === group).map(
                    (candidate) => {
                      const active = candidate.slug === page.slug;
                      return (
                        <li key={candidate.slug}>
                          <InternalLink
                            href={`/docs/${candidate.slug}`}
                            onNavigate={onNavigate}
                            className={`group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                              active
                                ? "bg-primary/25 text-primary-strong"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            }`}
                          >
                            <candidate.icon
                              aria-hidden="true"
                              className={`h-4 w-4 ${
                                active
                                  ? "text-primary-strong"
                                  : "text-muted-foreground group-hover:text-foreground"
                              }`}
                            />
                            {candidate.title}
                          </InternalLink>
                        </li>
                      );
                    },
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 px-5 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-14 xl:px-14">
        <div className="mb-9 lg:hidden">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Search documentation
            <kbd className="ml-auto rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <InternalLink
            href="/docs/getting-started"
            onNavigate={onNavigate}
            className="transition-colors hover:text-foreground"
          >
            Docs
          </InternalLink>
          <span aria-hidden="true">/</span>
          <span>{page.group}</span>
        </div>

        <header className="mb-10 border-b border-border/70 pb-9">
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-primary-strong/20 bg-primary/25 text-primary-strong shadow-sm">
            <page.icon aria-hidden="true" className="h-5 w-5" />
          </div>
          <h1 className="font-brand text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {page.description}
          </p>
        </header>

        <article className="docs-article">
          <DocArticle slug={page.slug} onNavigate={onNavigate} />
        </article>

        <nav
          aria-label="Adjacent documentation"
          className="mt-16 grid gap-3 border-t border-border/70 pt-8 sm:grid-cols-2"
        >
          {previous ? (
            <InternalLink
              href={`/docs/${previous.slug}`}
              onNavigate={onNavigate}
              className="group rounded-xl border border-border bg-card p-4 transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary-strong/35 hover:bg-muted/35 motion-reduce:hover:translate-y-0"
            >
              <span className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                Previous
              </span>
              <span className="font-semibold group-hover:text-primary-strong">
                {previous.title}
              </span>
            </InternalLink>
          ) : (
            <span />
          )}
          {next ? (
            <InternalLink
              href={`/docs/${next.slug}`}
              onNavigate={onNavigate}
              className="group rounded-xl border border-border bg-card p-4 text-right transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary-strong/35 hover:bg-muted/35 motion-reduce:hover:translate-y-0"
            >
              <span className="mb-2 flex items-center justify-end gap-1.5 text-xs font-medium text-muted-foreground">
                Next
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="font-semibold group-hover:text-primary-strong">
                {next.title}
              </span>
            </InternalLink>
          ) : null}
        </nav>
      </main>

      <aside className="hidden px-6 pb-16 pt-14 xl:block">
        <div className="sticky top-[88px]">
          <p className="mb-3 text-xs font-semibold text-foreground">
            On this page
          </p>
          <nav aria-label="On this page">
            <ul className="space-y-2.5 border-l border-border pl-4">
              {page.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-xs leading-5 text-muted-foreground transition-colors hover:text-primary-strong"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a
            href={`${REPO_URL}/issues/new`}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Question or issue
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      </aside>
    </div>
  );
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}

export function DocsSearchDialog({
  open,
  onOpenChange,
  onNavigate,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const normalized = normalize(query);
    if (!normalized) return DOC_PAGES;
    return DOC_PAGES.filter((page) =>
      normalize(`${page.title} ${page.description} ${page.group}`).includes(
        normalized,
      ),
    );
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search documentation</DialogTitle>
        <DialogDescription className="sr-only">
          Search Dahoko documentation by feature or topic.
        </DialogDescription>
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                onOpenChange(false);
                onNavigate(`/docs/${results[0].slug}`);
              }
            }}
            placeholder="Search documentation..."
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close search"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[min(430px,60vh)] overflow-y-auto p-2">
          {results.length ? (
            <ul className="space-y-1">
              {results.map((page) => (
                <li key={page.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onNavigate(`/docs/${page.slug}`);
                    }}
                    className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary-strong">
                      <page.icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {page.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {page.description}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="mt-2 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium">No documentation found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a feature name such as sync, views, or workspaces.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border bg-muted/35 px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="mr-1 rounded border border-border bg-card px-1 py-0.5">
              ↵
            </kbd>
            open
          </span>
          <span>
            <kbd className="mr-1 rounded border border-border bg-card px-1 py-0.5">
              esc
            </kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocArticle({
  slug,
  onNavigate,
}: {
  slug: DocSlug;
  onNavigate: (path: string) => void;
}) {
  switch (slug) {
    case "getting-started":
      return <GettingStarted onNavigate={onNavigate} />;
    case "quick-add":
      return <QuickAdd />;
    case "views":
      return <Views />;
    case "workspaces":
      return <Workspaces onNavigate={onNavigate} />;
    case "encrypted-sync":
      return <EncryptedSync onNavigate={onNavigate} />;
    case "import-export":
      return <ImportExport />;
    case "self-hosting":
      return <SelfHosting />;
  }
}

function GettingStarted({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <>
      <Callout icon={HardDrive} title="Local-first from the first launch">
        Dahoko opens directly into a usable workspace. An account is only
        needed if you choose to sync between devices.
      </Callout>

      <DocSection id="install" title="Install Dahoko">
        <p>
          Download the installer for your platform from the latest GitHub
          release. Dahoko ships signed updater artifacts for macOS, Windows,
          and Linux.
        </p>
        <LinkCard
          href={`${REPO_URL}/releases/latest`}
          icon={Download}
          title="Download the latest desktop release"
          description="DMG, MSI, EXE, AppImage, DEB, and RPM packages"
        />
      </DocSection>

      <DocSection id="first-task" title="Create your first task">
        <p>
          Put the cursor in the quick-add field, describe the task, then press{" "}
          <Key>Enter</Key>. You can include dates, tags, and priority in the same
          line.
        </p>
        <CodeBlock
          label="Quick add"
          code="Prepare launch notes tomorrow at 09:00 #release !p1"
        />
        <p>
          Dahoko keeps task capture fast and leaves the full detail editor for
          the moments when you need notes, subtasks, or recurring schedules.
        </p>
      </DocSection>

      <DocSection id="choose-view" title="Choose a view">
        <p>
          Every view reads from the same task database. Switch between a calm
          list and spatial swimlanes without moving or duplicating your tasks.
        </p>
        <CardGrid>
          <MiniCard
            icon={CheckCircle2}
            title="List"
            body="A compact, keyboard-friendly view for daily execution."
          />
          <MiniCard
            icon={Columns3}
            title="Swimlanes"
            body="Drag tasks between statuses and scan work in progress."
          />
        </CardGrid>
      </DocSection>

      <DocSection id="next-steps" title="Next steps">
        <p>
          Create separate workspaces for different contexts, then enable
          encrypted sync if you want the same data on another device.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InternalLink
            href="/docs/workspaces"
            onNavigate={onNavigate}
            className="docs-link-card"
          >
            <Database aria-hidden="true" className="h-5 w-5" />
            <span>
              <strong>Organize workspaces</strong>
              <small>Keep contexts isolated</small>
            </span>
            <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4" />
          </InternalLink>
          <InternalLink
            href="/docs/encrypted-sync"
            onNavigate={onNavigate}
            className="docs-link-card"
          >
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            <span>
              <strong>Connect another device</strong>
              <small>Enable end-to-end encrypted sync</small>
            </span>
            <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4" />
          </InternalLink>
        </div>
      </DocSection>
    </>
  );
}

function QuickAdd() {
  return (
    <>
      <p>
        Quick add turns a short line of text into a structured task. The title
        stays readable while recognized dates, tags, and priorities become task
        metadata.
      </p>
      <DocSection id="syntax" title="Syntax">
        <CodeBlock
          label="Pattern"
          code="Task title [date/time] [#tag] [!priority]"
        />
        <p>
          Everything is optional except the title. Press <Key>Enter</Key> to
          create the task or <Key>Escape</Key> to clear the field.
        </p>
      </DocSection>
      <DocSection id="dates" title="Dates and times">
        <p>
          Use natural relative dates or an explicit date and time. Dahoko stores
          the normalized date while keeping the task title clean.
        </p>
        <ExampleTable
          rows={[
            ["Send weekly recap tomorrow", "Tomorrow"],
            ["Review budget Friday at 14:30", "Friday, 2:30 PM"],
            ["Renew certificate 2026-08-15", "August 15, 2026"],
          ]}
        />
      </DocSection>
      <DocSection id="organization" title="Tags and priorities">
        <p>
          Prefix a word with <InlineCode>#</InlineCode> to add a tag. Use{" "}
          <InlineCode>!p1</InlineCode> through <InlineCode>!p4</InlineCode> for
          priority.
        </p>
        <Callout icon={Sparkles} title="Capture first, refine later">
          Quick add is optimized for momentum. Open the task detail modal when
          you want to add notes, subtasks, recurrence, or a specific status.
        </Callout>
      </DocSection>
      <DocSection id="examples" title="Examples">
        <CodeBlock
          label="Examples"
          code={`Call the accountant tomorrow #finance !p1
Plan team retro Friday at 10:00 #work
Replace water filter #home !p3`}
        />
      </DocSection>
    </>
  );
}

function Views() {
  return (
    <>
      <p>
        Views are lenses over one shared task collection. Changing a view never
        creates a separate copy or changes which workspace owns the task.
      </p>
      <DocSection id="available-views" title="Available views">
        <CardGrid>
          <MiniCard
            icon={CheckCircle2}
            title="List"
            body="Dense, focused rows grouped by the current filter."
          />
          <MiniCard
            icon={Columns3}
            title="Swimlanes"
            body="Horizontal status columns with smooth drag and drop."
          />
          <MiniCard
            icon={Tags}
            title="Grouped"
            body="Organize the same tasks by tag, list, or priority."
          />
        </CardGrid>
      </DocSection>
      <DocSection id="swimlanes" title="Swimlanes">
        <p>
          Drag a card to another lane to change its status. Lanes scroll
          horizontally when the board is wider than the window, and cards keep
          a stable size while moving.
        </p>
        <Callout icon={Info} title="Drag with intent">
          Dahoko uses a small movement threshold before starting a drag, so
          opening a task remains easy even on a dense board.
        </Callout>
      </DocSection>
      <DocSection id="defaults" title="Default views">
        <p>
          Open <strong>Settings → Appearance → Default views</strong> to choose
          a different default for each section. For example, Recurring can open
          as a list while Inbox and Today open as swimlanes.
        </p>
      </DocSection>
      <DocSection id="zoom" title="Desktop zoom">
        <p>
          Use <Key>⌘</Key> + <Key>+</Key> and <Key>⌘</Key> + <Key>−</Key> on
          macOS, or <Key>Ctrl</Key> on Windows and Linux, to adjust the desktop
          interface scale.
        </p>
      </DocSection>
    </>
  );
}

function Workspaces({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <>
      <p>
        A workspace is an isolated task environment with its own lists,
        statuses, tags, completion history, and tasks.
      </p>
      <DocSection id="create" title="Create a workspace">
        <StepList
          steps={[
            ["Open the switcher", "Select the workspace control at the top-left of the sidebar."],
            ["Choose Create workspace", "Give the workspace a clear, unique name."],
            ["Start adding tasks", "The new workspace opens immediately with clean defaults."],
          ]}
        />
      </DocSection>
      <DocSection id="switch" title="Switch workspaces">
        <p>
          Open the top-left switcher and select a workspace. Dahoko safely
          finishes pending database work before changing context, so rapid
          switching cannot race task updates.
        </p>
      </DocSection>
      <DocSection id="isolation" title="Data isolation">
        <Callout icon={ShieldCheck} title="Clear workspace boundaries">
          Tasks, tags, lists, statuses, subtasks, and completion history are
          scoped to the active workspace. Data from another workspace never
          appears in filters or search results.
        </Callout>
      </DocSection>
      <DocSection id="sync" title="Workspace sync">
        <p>
          Encrypted sync includes every workspace and its metadata in one
          encrypted bundle. Workspace names are encrypted along with task
          content.
        </p>
        <InternalLink
          href="/docs/encrypted-sync"
          onNavigate={onNavigate}
          className="docs-link-card mt-5"
        >
          <LockKeyhole aria-hidden="true" className="h-5 w-5" />
          <span>
            <strong>Understand encrypted sync</strong>
            <small>Privacy model, setup, and recovery</small>
          </span>
          <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4" />
        </InternalLink>
      </DocSection>
    </>
  );
}

function EncryptedSync({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <>
      <Callout icon={LockKeyhole} title="The server stores ciphertext">
        Task titles, notes, workspace names, tags, and list names are encrypted
        on your device before upload. The sync service cannot read them.
      </Callout>
      <DocSection id="model" title="Privacy model">
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <FlowCard icon={HardDrive} label="Your device" detail="Encrypts data" />
          <FlowCard icon={Cloud} label="Sync service" detail="Stores ciphertext" />
          <FlowCard icon={HardDrive} label="Other device" detail="Decrypts locally" />
        </div>
        <p>
          Account credentials identify the encrypted bundle. A separate
          encryption passphrase derives the key used to protect its contents.
        </p>
      </DocSection>
      <DocSection id="connect" title="Connect a device">
        <StepList
          steps={[
            ["Open Settings", "Select Sync and choose the hosted or self-hosted server URL."],
            ["Create or sign in", "Use an email and account password to authenticate."],
            ["Enter the encryption passphrase", "Use the same passphrase on every device."],
            ["Run the first sync", "Dahoko merges workspaces and records the encrypted result."],
          ]}
        />
      </DocSection>
      <DocSection id="conflicts" title="Conflict handling">
        <p>
          Dahoko uses record-level hybrid logical clocks and deterministic
          last-write-wins merging. Independent changes converge without
          replacing an entire database, and deletions travel as tombstones.
        </p>
      </DocSection>
      <DocSection id="recovery" title="Passphrases and recovery">
        <Callout icon={AlertTriangle} title="Keep your encryption passphrase safe" tone="warning">
          The server never receives the readable passphrase or an unencrypted
          recovery copy. Losing the passphrase means the encrypted server data
          cannot be recovered.
        </Callout>
        <p>
          Before enabling sync, create a local export and store it somewhere
          you control. See{" "}
          <InternalLink
            href="/docs/import-export"
            onNavigate={onNavigate}
            className="docs-inline-link"
          >
            import and export
          </InternalLink>
          .
        </p>
      </DocSection>
    </>
  );
}

function ImportExport() {
  return (
    <>
      <p>
        Dahoko’s portable backup format makes it easy to keep an offline copy,
        move a workspace, or recover from an unwanted change.
      </p>
      <DocSection id="export" title="Export a workspace">
        <StepList
          steps={[
            ["Activate the workspace", "The export applies only to the workspace currently open."],
            ["Open Settings → Data", "Choose Export workspace."],
            ["Store the file safely", "The filename includes the workspace name and export date."],
          ]}
        />
        <div className="docs-file">
          <FileJson aria-hidden="true" className="h-5 w-5 text-primary-strong" />
          <span>dahoko-personal-2026-07-27.json</span>
        </div>
      </DocSection>
      <DocSection id="import" title="Import a workspace">
        <p>
          Select a Dahoko export from Settings. Import replaces the active
          workspace after validating every list, task, status, subtask, and
          completion record.
        </p>
      </DocSection>
      <DocSection id="safety" title="Restore safely">
        <Callout icon={AlertTriangle} title="Import is intentionally explicit" tone="warning">
          Importing replaces the current workspace. Export its current state
          first if you may need to return to it.
        </Callout>
        <p>
          Validation and replacement happen transactionally, so an invalid file
          cannot leave the SQLite database half-imported.
        </p>
      </DocSection>
    </>
  );
}

function SelfHosting() {
  return (
    <>
      <p>
        The Dahoko sync server is a small open-source Node service that stores
        one opaque encrypted bundle per account. It is available as source and
        as a container image.
      </p>
      <DocSection id="requirements" title="Requirements">
        <ul>
          <li>A host capable of running Docker or Node.js 22</li>
          <li>A persistent volume for the server database</li>
          <li>HTTPS in front of the service for production use</li>
          <li>A long, unique token-pepper secret</li>
        </ul>
      </DocSection>
      <DocSection id="docker" title="Run with Docker">
        <CodeBlock
          label="Terminal"
          code={`git clone https://github.com/megancooper/dahoko.git
cd dahoko
cp apps/sync-server/.env.example apps/sync-server/.env
docker compose -f compose.sync.yaml up -d --build`}
        />
        <p>
          The compose file mounts persistent storage and exposes the service on
          its configured port.
        </p>
      </DocSection>
      <DocSection id="configuration" title="Configuration">
        <CodeBlock
          label=".env"
          code={`DAHOKO_SYNC_HOST=0.0.0.0
DAHOKO_SYNC_PORT=8787
DAHOKO_SYNC_DATA_DIR=/data
DAHOKO_SYNC_TOKEN_PEPPER=replace-with-a-long-random-secret`}
        />
        <Callout icon={KeyRound} title="Treat the token pepper as a secret">
          Do not commit it, expose it to the browser, or reuse it between
          environments.
        </Callout>
      </DocSection>
      <DocSection id="operations" title="Operations">
        <p>
          Back up the persistent data directory, keep the container current,
          and monitor the health endpoint from your hosting platform.
        </p>
        <CodeBlock label="Health check" code="curl https://sync.example.com/health" />
        <LinkCard
          href={`${REPO_URL}/blob/main/docs/sync.md`}
          icon={ServerCog}
          title="Read the sync architecture"
          description="Protocol, security model, API, deployment, and operations"
        />
      </DocSection>
    </>
  );
}

function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Callout({
  icon: Icon,
  title,
  tone = "info",
  children,
}: {
  icon: typeof Info;
  title: string;
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <aside
      className={`docs-callout ${
        tone === "warning" ? "docs-callout-warning" : ""
      }`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          {children}
        </div>
      </div>
    </aside>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="docs-code">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <Terminal aria-hidden="true" className="h-3.5 w-3.5" />
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="docs-key">{children}</kbd>;
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="docs-inline-code">{children}</code>;
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">{children}</div>;
}

function MiniCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Info;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-primary-strong" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function FlowCard({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Info;
  label: string;
  detail: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-4 text-center">
      <span className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/25 text-primary-strong">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function LinkCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Info;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="docs-link-card mt-5"
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ExternalLink aria-hidden="true" className="ml-auto h-4 w-4" />
    </a>
  );
}

function StepList({ steps }: { steps: Array<[string, string]> }) {
  return (
    <ol className="mt-6 space-y-5">
      {steps.map(([title, body], index) => (
        <li key={title} className="relative flex gap-4">
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[17px] top-9 h-[calc(100%+4px)] w-px bg-border"
            />
          ) : null}
          <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary-strong/25 bg-primary/25 text-sm font-bold text-primary-strong">
            {index + 1}
          </span>
          <div className="pt-1">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ExampleTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/70 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Input</th>
            <th className="px-4 py-3 font-medium">Parsed due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([input, result]) => (
            <tr key={input} className="bg-card">
              <td className="px-4 py-3 font-mono text-xs">{input}</td>
              <td className="px-4 py-3 text-muted-foreground">{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
