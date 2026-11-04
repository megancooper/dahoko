import {
  ArrowUpRight,
  Check,
  Download,
  Github,
  Menu,
  Search,
  X,
} from "lucide-react";
import { cn, ThemeToggle, TooltipProvider, VersionBadge } from "@dahoko/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import desktopConfig from "../../desktop/src-tauri/tauri.conf.json";
import { DOC_PAGE_BY_SLUG, DOC_PAGES, isDocSlug } from "./content";
import { DocsLayout, DocsSearchDialog, InternalLink } from "./docs";
import { AccountPage } from "./account";
import { LandingExperience } from "./landing";

const REPO_URL = "https://github.com/megancooper/dahoko";
const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;

// The marketing page is art-directed as a fixed dark surface; docs and the
// account area follow the user's light/dark preference.
const THEME_COLOR = { marketing: "#09090b", app: "#A3D0FF" } as const;

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function getPageTitle(pathname: string) {
  if (pathname === "/account") {
    return "Account — dahoko";
  }
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

  const isDocs = pathname === "/docs" || pathname.startsWith("/docs/");
  const isAccount = pathname === "/account";
  const isMarketing = !isDocs && !isAccount;

  useEffect(() => {
    document.title = getPageTitle(pathname);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        isMarketing ? THEME_COLOR.marketing : THEME_COLOR.app,
      );
  }, [pathname, isMarketing]);

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

  const selectedDoc = useMemo(() => {
    const slug = pathname.split("/")[2] || "getting-started";
    return isDocSlug(slug)
      ? DOC_PAGE_BY_SLUG.get(slug)
      : DOC_PAGE_BY_SLUG.get("getting-started");
  }, [pathname]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-dvh bg-background text-foreground",
          isMarketing && "marketing",
        )}
      >
        <SiteHeader
          isDocs={isDocs}
          isMarketing={isMarketing}
          pathname={pathname}
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
        ) : isAccount ? (
          <AccountPage onNavigate={navigate} />
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

const NAV_ITEMS = [
  { label: "Docs", href: "/docs/getting-started", match: "/docs" },
  { label: "Pricing", href: "/#cloud", match: null },
  { label: "Self-host", href: "/docs/self-hosting", match: "/docs/self-hosting" },
  { label: "Releases", href: `${REPO_URL}/releases`, match: null, external: true },
] as const;

function SiteHeader({
  isDocs,
  isMarketing,
  pathname,
  mobileMenuOpen,
  onMobileMenuChange,
  onNavigate,
  onOpenSearch,
}: {
  isDocs: boolean;
  isMarketing: boolean;
  pathname: string;
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileMenuChange(false);
    };
    const media = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (media.matches) onMobileMenuChange(false);
    };
    window.addEventListener("keydown", close);
    media.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", close);
      media.removeEventListener("change", onResize);
    };
  }, [mobileMenuOpen, onMobileMenuChange]);

  const isCurrent = (match: string | null) =>
    match !== null &&
    (match === "/docs"
      ? pathname.startsWith("/docs") && !pathname.startsWith("/docs/self-hosting")
      : pathname === match);

  const frameClass = cn("mk-frame", isDocs && "mk-frame-wide");

  return (
    <header
      className="mk-header"
      data-scrolled={scrolled}
      data-open={mobileMenuOpen}
    >
      <div className={cn(frameClass, "mk-header-row")}>
        <InternalLink href="/" onNavigate={onNavigate} className="mk-brand">
          <span className="mk-brand-mark" aria-hidden="true">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="mk-brand-name">dahoko</span>
          <VersionBadge version={desktopConfig.version} />
        </InternalLink>

        <nav aria-label="Primary" className="mk-nav">
          {NAV_ITEMS.map((item) =>
            "external" in item ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mk-nav-link"
              >
                {item.label}
              </a>
            ) : item.href.startsWith("/#") ? (
              <a key={item.label} href={item.href} className="mk-nav-link">
                {item.label}
              </a>
            ) : (
              <InternalLink
                key={item.label}
                href={item.href}
                onNavigate={onNavigate}
                className="mk-nav-link"
                {...(isCurrent(item.match) ? { "aria-current": "page" } : {})}
              >
                {item.label}
              </InternalLink>
            ),
          )}
        </nav>

        <div className="mk-header-actions">
          {isDocs ? (
            <button type="button" onClick={onOpenSearch} className="mk-search">
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              Search docs
              <kbd>⌘K</kbd>
            </button>
          ) : null}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="mk-btn mk-btn-ghost mk-btn-sm mk-from-sm"
          >
            <Github aria-hidden="true" />
            GitHub
          </a>
          {isMarketing ? null : <ThemeToggle />}
          <InternalLink
            href="/account"
            onNavigate={onNavigate}
            className={cn(
              "mk-btn mk-btn-ghost mk-btn-sm mk-from-md",
              pathname === "/account" && "text-foreground",
            )}
          >
            Account
          </InternalLink>
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            className="mk-btn mk-btn-primary mk-btn-sm ml-1"
          >
            <Download aria-hidden="true" />
            Download
          </a>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => onMobileMenuChange(!mobileMenuOpen)}
            className="mk-menu-toggle ml-1"
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
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="mk-mobile-nav"
        >
          <div className={cn(frameClass, "mk-mobile-nav-inner")}>
            <InternalLink
              href="/docs/getting-started"
              onNavigate={onNavigate}
              className="mk-mobile-nav-link"
            >
              Documentation
            </InternalLink>
            <a
              href="/#cloud"
              className="mk-mobile-nav-link"
              onClick={() => onMobileMenuChange(false)}
            >
              Pricing
            </a>
            <InternalLink
              href="/docs/self-hosting"
              onNavigate={onNavigate}
              className="mk-mobile-nav-link"
            >
              Self-host
            </InternalLink>
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              className="mk-mobile-nav-link"
            >
              Releases
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="mk-mobile-nav-link"
            >
              GitHub
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <InternalLink
              href="/account"
              onNavigate={onNavigate}
              className="mk-mobile-nav-link"
            >
              Account
            </InternalLink>
            <div className="mk-mobile-nav-footer">
              <a
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="mk-btn mk-btn-primary mk-btn-lg w-full"
              >
                <Download aria-hidden="true" />
                Download for desktop
              </a>
            </div>
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
