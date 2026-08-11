import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  ExternalLink,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
import { Button } from "@dahoko/ui";
import { useCallback, useEffect, useState } from "react";
import {
  AccountApiError,
  decryptWorkspaces,
  getBillingState,
  getSyncInfo,
  loadSession,
  login,
  logout,
  openPortal,
  refreshBilling,
  saveSession,
  startCheckout,
  SYNC_SERVER_URL,
  type AccountSession,
  type BillingState,
  type DecryptedWorkspace,
  type RemoteSyncInfo,
} from "./account-api";
import { InternalLink } from "./docs";

function errorMessage(error: unknown): string {
  return error instanceof AccountApiError || error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const cardClass =
  "rounded-2xl border border-border bg-card p-6 shadow-soft";
const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm shadow-soft outline-none focus:ring-2 focus:ring-ring";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function AccountPage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const [session, setSession] = useState<AccountSession | null>(loadSession);

  const signOut = useCallback(async () => {
    const current = session;
    setSession(null);
    saveSession(null);
    if (current) await logout(current);
  }, [session]);

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-12 sm:px-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-strong">
        Dahoko Cloud
      </p>
      <h1 className="font-brand text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        Your account
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Manage your Dahoko Cloud subscription and see what the server holds
        for you. Your tasks are end-to-end encrypted — this page can only
        decrypt them locally in your browser, with your passphrase.
      </p>

      <div className="mt-8">
        {session ? (
          <AccountDashboard session={session} onSignOut={signOut} />
        ) : (
          <SignIn onSignedIn={(next) => setSession(next)} onNavigate={onNavigate} />
        )}
      </div>
    </main>
  );
}

function SignIn({
  onSignedIn,
  onNavigate,
}: {
  onSignedIn: (session: AccountSession) => void;
  onNavigate: (path: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await login(email, password);
      saveSession(session);
      onSignedIn(session);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <form
        className={cardClass}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary-strong/25 bg-primary/20 text-primary-strong">
            <User aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Sign in</h2>
            <p className="text-xs text-muted-foreground">
              Use your sync account email and password
            </p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="mb-5 block">
          <span className={labelClass}>Account password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 text-sm text-destructive"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 flex-shrink-0"
            />
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? (
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <aside className="flex flex-col gap-4">
        <div className={cardClass}>
          <ShieldCheck
            aria-hidden="true"
            className="mb-3 h-5 w-5 text-primary-strong"
          />
          <p className="text-sm font-semibold">No account yet?</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Accounts are created in the Dahoko desktop app under Settings →
            Sync, together with the encryption passphrase that protects your
            data.
          </p>
          <InternalLink
            href="/docs/encrypted-sync"
            onNavigate={onNavigate}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong hover:underline"
          >
            How encryption works
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </InternalLink>
        </div>
        <div className={cardClass}>
          <EyeOff
            aria-hidden="true"
            className="mb-3 h-5 w-5 text-muted-foreground"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Signing in proves you own the account. It does not give this site
            — or the server — the ability to read your tasks.
          </p>
        </div>
      </aside>
    </div>
  );
}

function AccountDashboard({
  session,
  onSignOut,
}: {
  session: AccountSession;
  onSignOut: () => Promise<void>;
}) {
  const [billing, setBilling] = useState<BillingState | null | "loading">(
    "loading",
  );
  const [syncInfo, setSyncInfo] = useState<RemoteSyncInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      // Eagerly re-sync from Stripe when arriving back from checkout.
      if (
        new URLSearchParams(window.location.search).get("checkout") ===
        "success"
      ) {
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        await refreshBilling(session).catch(() => {});
      }
      const [billingState, sync] = await Promise.all([
        getBillingState(session),
        getSyncInfo(session),
      ]);
      setBilling(billingState);
      setSyncInfo(sync);
    } catch (cause) {
      if (cause instanceof AccountApiError && cause.status === 401) {
        await onSignOut();
        return;
      }
      setBilling(null);
      setError(errorMessage(cause));
    }
  }, [session, onSignOut]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const subscription = billing !== "loading" && billing ? billing.subscription : null;
  const active =
    subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <User aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {SYNC_SERVER_URL}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onSignOut()}
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 flex-shrink-0"
          />
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="plan-title" className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary-strong/25 bg-primary/20 text-primary-strong">
                <Sparkles aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h2 id="plan-title" className="text-lg font-bold tracking-tight">
                  Plan
                </h2>
                <p className="text-xs text-muted-foreground">
                  Dahoko Cloud subscription
                </p>
              </div>
            </div>
            {billing === "loading" ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            ) : (
              <span
                className={
                  active
                    ? "rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success"
                    : "rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                }
              >
                {active
                  ? subscription?.status === "trialing"
                    ? "Pro · trial"
                    : "Pro"
                  : "Free"}
              </span>
            )}
          </div>

          {billing === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading plan…</p>
          ) : billing === null ? (
            <p className="text-sm leading-6 text-muted-foreground">
              This server runs without billing (self-hosted). There is nothing
              to manage here.
            </p>
          ) : active ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {subscription?.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                {subscription?.currentPeriodEnd
                  ? new Date(
                      subscription.currentPeriodEnd * 1_000,
                    ).toLocaleDateString()
                  : "—"}
                {subscription?.paymentMethod
                  ? ` · ${subscription.paymentMethod.brand ?? "card"} ····${subscription.paymentMethod.last4 ?? ""}`
                  : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      window.location.href = await openPortal(session);
                    })
                  }
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Manage subscription
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await refreshBilling(session);
                      await reload();
                    })
                  }
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Cancel, switch between monthly and yearly, or update your card
                in the Stripe portal.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Upgrade to sync across devices on hosted,
                end-to-end-encrypted Dahoko Cloud.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      window.location.href = await startCheckout(
                        session,
                        "monthly",
                      );
                    })
                  }
                >
                  <Cloud aria-hidden="true" className="h-4 w-4" />
                  Upgrade · $4/mo
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      window.location.href = await startCheckout(
                        session,
                        "yearly",
                      );
                    })
                  }
                >
                  $40/yr · 2 months free
                </Button>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="storage-title" className={cardClass}>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted text-foreground">
              <LockKeyhole aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="storage-title"
                className="text-lg font-bold tracking-tight"
              >
                Encrypted storage
              </h2>
              <p className="text-xs text-muted-foreground">
                What the server holds for this account
              </p>
            </div>
          </div>
          {syncInfo ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/80 bg-background p-3">
                <dt className="text-xs text-muted-foreground">Revision</dt>
                <dd className="mt-1 font-mono font-semibold">
                  {syncInfo.revision}
                </dd>
              </div>
              <div className="rounded-xl border border-border/80 bg-background p-3">
                <dt className="text-xs text-muted-foreground">
                  Encrypted size
                </dt>
                <dd className="mt-1 font-mono font-semibold">
                  {formatBytes(syncInfo.encryptedBytes)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <EyeOff
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
            />
            The server stores this as ciphertext. Nobody — including us — can
            read it without your encryption passphrase.
          </p>
        </section>
      </div>

      {syncInfo?.blob ? (
        <DataViewer session={session} blob={syncInfo.blob} />
      ) : null}
    </div>
  );
}

function DataViewer({
  session,
  blob,
}: {
  session: AccountSession;
  blob: Record<string, unknown>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<DecryptedWorkspace[] | null>(
    null,
  );

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      setWorkspaces(
        await decryptWorkspaces(blob, passphrase, session.encryptionSalt),
      );
      setPassphrase("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="data-title" className={cardClass}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted text-foreground">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id="data-title" className="text-lg font-bold tracking-tight">
            View your data
          </h2>
          <p className="text-xs text-muted-foreground">
            Decrypted in this browser tab only — the passphrase is never sent
            anywhere
          </p>
        </div>
      </div>

      {workspaces === null ? (
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            required
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Encryption passphrase"
            aria-label="Encryption passphrase"
            className={inputClass}
          />
          <Button type="submit" disabled={busy} className="sm:w-auto">
            {busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <LockKeyhole aria-hidden="true" className="h-4 w-4" />
            )}
            {busy ? "Decrypting…" : "Decrypt & view"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {workspaces.map((workspace) => (
            <article
              key={workspace.id}
              className="rounded-xl border border-border/80 bg-background p-4"
            >
              <header className="mb-3 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: workspace.color }}
                />
                <h3 className="text-sm font-bold">{workspace.name}</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  {workspace.openTasks.length} open ·{" "}
                  {workspace.completedCount} done
                </span>
              </header>
              {workspace.openTasks.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-4 w-4 text-success"
                  />
                  All clear.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {workspace.openTasks.slice(0, 8).map((task, index) => (
                    <li
                      key={`${workspace.id}-${index}`}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="h-[15px] w-[15px] flex-shrink-0 rounded-full border-[1.5px] border-input"
                      />
                      <span className="min-w-0 truncate">{task.title}</span>
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                      {task.dueAt ? (
                        <span className="ml-auto flex-shrink-0 font-mono text-xs text-muted-foreground">
                          {task.dueAt.slice(0, 10)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {workspace.openTasks.length > 8 ? (
                    <li className="text-xs text-muted-foreground">
                      … and {workspace.openTasks.length - 8} more in the app
                    </li>
                  ) : null}
                </ul>
              )}
            </article>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setWorkspaces(null)}
          >
            <EyeOff aria-hidden="true" className="h-4 w-4" />
            Hide decrypted data
          </Button>
        </div>
      )}
    </section>
  );
}
