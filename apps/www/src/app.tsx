import { Check, Columns3, Database, Github, Tags } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  ThemeToggle,
  TooltipProvider,
  VersionBadge,
} from "@dahoko/ui";
import desktopConfig from "../../desktop/src-tauri/tauri.conf.json";

const REPO_URL = "https://github.com/megancooper/dahoko";
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;

const FEATURES = [
  {
    icon: Columns3,
    title: "Your views",
    body: "The same tasks as a grouped list, drag-and-drop swimlanes, or grouped by tag, list, and priority. Pick the lens that fits the moment.",
  },
  {
    icon: Database,
    title: "Your database",
    body: "Everything lives in a local SQLite file on your machine. No account, no sync service reading your todo list, no lock-in.",
  },
  {
    icon: Tags,
    title: "Quick-add that thinks",
    body: 'Type "Buy milk tomorrow at 15:00 #errand !p2" and dahoko files the date, time, tag, and priority for you.',
  },
] as const;

export function App() {
  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

function AppContent() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg border border-primary-strong/30 bg-primary text-primary-foreground">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <span className="font-brand text-lg font-semibold tracking-tight">
            dahoko
          </span>
          <VersionBadge version={desktopConfig.version} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" /> GitHub
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="container pb-24">
        <section className="mx-auto max-w-3xl pb-16 pt-20 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-strong">
            Open source · Local first · MIT licensed
          </p>
          <h1 className="font-brand text-5xl font-bold leading-tight tracking-tight">
            Your tasks. Your views.
            <br />
            Your database.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            dahoko is an open-source task manager that keeps everything in a
            local SQLite file — and lets you see the same tasks as a list,
            swimlanes, or by tag.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
                Download for desktop
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                Star on GitHub
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            macOS, Windows, and Linux · built with Tauri
          </p>
        </section>

        <section className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <feature.icon className="mb-3 h-5 w-5 text-primary-strong" />
                <h2 className="mb-1.5 text-sm font-semibold">
                  {feature.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} dahoko contributors</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
