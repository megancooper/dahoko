import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button, Input, SegmentedControl } from "@dahoko/ui";
import { useSync } from "@/state/sync";
import { openExternal } from "@/lib/open-external";
import { generateEncryptionPassphrase } from "@/sync/passphrase";

const SELF_HOSTING_DOCS_URL = "https://dahoko.com/docs/self-hosting";
const HOSTED_PRICE = "$4/month or $40/year";

type ConnectMode = "register" | "login";

/** Clipboard writes need a secure context; the Tauri origin qualifies, but
 * fall back to a selection copy so the button never silently does nothing. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      area.remove();
    }
    return ok;
  }
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  const copy = useCallback(async (text: string) => {
    if (await copyText(text)) setCopied(true);
  }, []);
  return { copied, copy };
}

function ExternalTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
      onClick={(event) => {
        event.preventDefault();
        void openExternal(href).catch(() => {});
      }}
    >
      {children}
    </a>
  );
}

/** Pricing shown before the account exists, so nobody discovers the
 * subscription after signing up. */
function PlanNotice({ hosted }: { hosted: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center gap-2 text-[12px] font-medium">
        {hosted ? (
          <Sparkles
            aria-hidden="true"
            className="h-3.5 w-3.5 text-muted-foreground"
          />
        ) : (
          <Server
            aria-hidden="true"
            className="h-3.5 w-3.5 text-muted-foreground"
          />
        )}
        {hosted ? `Dahoko Cloud · ${HOSTED_PRICE}` : "Self-hosted server · free"}
      </div>
      {hosted ? (
        <>
          <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
            Creating an account is free, but uploading from this device needs
            a paid plan. You pick monthly or yearly after the account exists
            and can cancel anytime. Downloading and deleting your data never
            requires a subscription.
          </p>
          <p className="mt-1.5 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
            Prefer free? Run the open-source sync server yourself and enter
            its URL below.{" "}
            <ExternalTextLink href={SELF_HOSTING_DOCS_URL}>
              Self-hosting guide
            </ExternalTextLink>
            .
          </p>
        </>
      ) : (
        <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
          You're connecting to your own server. Dahoko never bills for
          self-hosted sync.
        </p>
      )}
    </div>
  );
}

function BillingSection() {
  const { billing, startCheckout, openBillingPortal, refreshBilling, syncNow } =
    useSync();
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Eagerly re-sync plan state when the user returns from the browser
  // checkout — usually before Stripe's webhook lands.
  useEffect(() => {
    if (!checkoutUrl) return;
    const onFocus = () => {
      void refreshBilling()
        .then(() => syncNow().catch(() => {}))
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkoutUrl, refreshBilling, syncNow]);

  if (!billing) return null;
  const { subscription } = billing;
  const active =
    subscription.status === "active" || subscription.status === "trialing";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The billing action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const checkout = (interval: "monthly" | "yearly") =>
    run(async () => {
      const url = await startCheckout(interval);
      // Keep the fallback link even if the OS handoff fails, so the user can
      // still reach checkout.
      setCheckoutUrl(url);
      await openExternal(url);
    });

  return (
    <div className="mt-3 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <Sparkles
          aria-hidden="true"
          className="h-3.5 w-3.5 text-muted-foreground"
        />
        Dahoko Cloud plan
        <span
          className={
            active
              ? "ml-auto rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success"
              : "ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground"
          }
        >
          {active
            ? subscription.status === "trialing"
              ? "Pro · trial"
              : "Pro"
            : "Free"}
        </span>
      </div>

      {active && subscription.status !== "none" ? (
        <div className="mt-1.5 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
          {"currentPeriodEnd" in subscription && subscription.currentPeriodEnd ? (
            <span className="block">
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
              {new Date(
                subscription.currentPeriodEnd * 1_000,
              ).toLocaleDateString()}
              {"paymentMethod" in subscription && subscription.paymentMethod
                ? ` · ${subscription.paymentMethod.brand ?? "card"} ····${subscription.paymentMethod.last4 ?? ""}`
                : null}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
          Upgrade to sync this account across devices on hosted,
          end-to-end-encrypted Dahoko Cloud. {HOSTED_PRICE}, cancel anytime.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2 pl-[22px]">
        {active ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await openExternal(await openBillingPortal());
              })
            }
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            Manage billing
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void checkout("monthly")}
            >
              Upgrade · $4/mo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void checkout("yearly")}
            >
              $40/yr · 2 months free
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refreshBilling();
            })
          }
        >
          Refresh
        </Button>
      </div>

      {checkoutUrl && !active ? (
        <p className="mt-2 pl-[22px] text-[11px] leading-relaxed text-muted-foreground">
          Checkout opened in your browser. If it didn't,{" "}
          <ExternalTextLink href={checkoutUrl}>open it here</ExternalTextLink>.
          Your plan refreshes automatically when you return.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-2 pl-[22px] text-[11.5px] leading-relaxed text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shown after an account was created in this session, so the passphrase can
 * still be copied to a second device once the form is gone. */
function SessionPassphrase({ passphrase }: { passphrase: string }) {
  const [revealed, setRevealed] = useState(false);
  const { copied, copy } = useCopy();
  return (
    <div className="mt-3 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <KeyRound
          aria-hidden="true"
          className="h-3.5 w-3.5 text-muted-foreground"
        />
        Encryption passphrase
      </div>
      <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
        Save this now: you need it to sign in on another device, and it
        disappears when you disconnect or quit. Nobody can recover it.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[22px]">
        <code
          aria-label={revealed ? "Encryption passphrase" : "Passphrase hidden"}
          className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[12px] tracking-wide"
        >
          {revealed ? passphrase : "•••••-•••••-•••••-•••••-•••••"}
        </code>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={revealed}
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? (
            <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {revealed ? "Hide" : "Show"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copy(passphrase)}
        >
          {copied ? (
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function SyncSettings() {
  const {
    status,
    message,
    account,
    savedConfig,
    hostedServerUrl,
    lastSyncedAt,
    sessionPassphrase,
    connect,
    disconnect,
    deleteAccount,
    syncNow,
  } = useSync();
  const [mode, setMode] = useState<ConnectMode>(() =>
    savedConfig?.email ? "login" : "register",
  );
  const [serverUrl, setServerUrl] = useState(
    savedConfig?.serverUrl || hostedServerUrl,
  );
  const [email, setEmail] = useState(savedConfig?.email ?? "");
  const [password, setPassword] = useState("");
  const [loginPassphrase, setLoginPassphrase] = useState("");
  const [generatedPassphrase, setGeneratedPassphrase] = useState(
    generateEncryptionPassphrase,
  );
  const { copied, copy } = useCopy();
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [pendingMode, setPendingMode] = useState<ConnectMode | null>(null);
  const busy =
    status === "connecting" || status === "syncing" || pendingMode !== null;
  const hosted = Boolean(hostedServerUrl) && serverUrl.trim() === hostedServerUrl;

  useEffect(() => {
    if (savedConfig?.serverUrl) setServerUrl(savedConfig.serverUrl);
    if (savedConfig?.email) setEmail(savedConfig.email);
  }, [savedConfig?.email, savedConfig?.serverUrl]);

  const submit = async () => {
    if (pendingMode) return;
    setPendingMode(mode);
    try {
      await connect({
        mode,
        serverUrl,
        email,
        password,
        encryptionPassphrase:
          mode === "register" ? generatedPassphrase : loginPassphrase,
      });
      setPassword("");
      setLoginPassphrase("");
      // The passphrase now lives with the account for this session; give the
      // next registration a fresh one.
      setGeneratedPassphrase(generateEncryptionPassphrase());
    } catch (error) {
      // The provider surfaces a safe, actionable message in this section;
      // keep the raw failure on the console for debugging.
      console.error("[dahoko] sync connect failed:", error);
    } finally {
      setPendingMode(null);
    }
  };

  const statusIcon =
    status === "syncing" || status === "connecting" ? (
      <LoaderCircle
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
      />
    ) : status === "error" ? (
      <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
    ) : account ? (
      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
    ) : (
      <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
    );

  return (
    <section
      aria-labelledby="encrypted-sync-title"
      className="rounded-lg border border-border bg-muted/35 p-3"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          aria-hidden="true"
          className="h-3.5 w-3.5 text-muted-foreground"
        />
        <h3 id="encrypted-sync-title" className="text-[13px] font-medium">
          Encrypted sync
        </h3>
      </div>
      <p className="mt-1 pl-[22px] text-[11.5px] leading-relaxed text-muted-foreground">
        Your workspaces and tasks are encrypted on this device. The server
        stores ciphertext and cannot read or recover your data.
      </p>

      {account ? (
        <div className="mt-3">
          <div className="rounded-md border border-border bg-background p-2.5">
            <div className="flex items-center gap-2 text-[12px] font-medium">
              <Cloud
                aria-hidden="true"
                className="h-3.5 w-3.5 text-muted-foreground"
              />
              <span className="min-w-0 truncate">{account.email}</span>
            </div>
            <div className="mt-1 truncate pl-[22px] text-[11px] text-muted-foreground">
              {account.serverUrl}
            </div>
          </div>

          <div
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              status === "error"
                ? "mt-3 flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-2.5 text-[11.5px] leading-relaxed text-destructive"
                : "mt-2 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground"
            }
          >
            <span className="mt-0.5 flex-shrink-0">{statusIcon}</span>
            <span>
              {message}
              {lastSyncedAt && status !== "error" ? (
                <span className="block">
                  Last synced {new Date(lastSyncedAt).toLocaleString()}.
                </span>
              ) : null}
            </span>
          </div>

          {sessionPassphrase ? (
            <SessionPassphrase passphrase={sessionPassphrase} />
          ) : null}

          <BillingSection />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void syncNow().catch(() => {})}
            >
              {status === "syncing" ? "Syncing…" : "Sync now"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructiveOutline"
              disabled={busy}
              onClick={() => setShowDelete(true)}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Delete server copy
            </Button>
          </div>

          {showDelete ? (
            <div className="mt-3 rounded-md border border-destructive/35 bg-destructive/5 p-2.5">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                This permanently deletes the server account and its encrypted
                copy. Tasks on this device stay intact.
              </p>
              <label className="mt-2 block">
                <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                  Confirm account password
                </span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setShowDelete(false);
                    setDeletePassword("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructiveOutline"
                  disabled={busy}
                  onClick={() =>
                    void deleteAccount(deletePassword)
                      .then(() => {
                        setShowDelete(false);
                        setDeletePassword("");
                      })
                      .catch(() => {})
                  }
                >
                  Delete encrypted account
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <PlanNotice hosted={hosted} />

          <SegmentedControl<ConnectMode>
            aria-label="Account action"
            size="sm"
            className="mt-3"
            value={mode}
            onValueChange={setMode}
            disabled={busy}
            options={[
              { value: "register", label: "Create account" },
              { value: "login", label: "Sign in" },
            ]}
          />

          {hostedServerUrl && !hosted ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setServerUrl(hostedServerUrl)}
            >
              <Cloud aria-hidden="true" className="h-3.5 w-3.5" />
              Use Dahoko Cloud
            </Button>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <label className="col-span-2 block">
              <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                <Server aria-hidden="true" className="h-3 w-3" />
                Sync server
              </span>
              <Input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder={
                  hostedServerUrl || "https://sync.your-domain.example"
                }
                disabled={busy}
              />
            </label>

            <label className="col-span-2 block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                Email
              </span>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>

            <label className="col-span-2 block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                Account password
              </span>
              <Input
                type="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>

            {mode === "register" ? (
              <div className="col-span-2">
                <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                  Encryption passphrase
                </span>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="text"
                    readOnly
                    aria-label="Generated encryption passphrase"
                    className="min-w-0 flex-1 font-mono text-[12.5px] tracking-wide"
                    value={generatedPassphrase}
                    onFocus={(event) => event.target.select()}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={busy}
                    onClick={() => void copy(generatedPassphrase)}
                  >
                    {copied ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9"
                    disabled={busy}
                    onClick={() =>
                      setGeneratedPassphrase(generateEncryptionPassphrase())
                    }
                  >
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Generated on this device; it never leaves it. Save it in your
                  password manager: you'll type it to sign in on another
                  device, and nobody can recover it if it's lost.
                </p>
              </div>
            ) : (
              <label className="col-span-2 block">
                <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                  Encryption passphrase
                </span>
                <Input
                  type="password"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="font-mono"
                  value={loginPassphrase}
                  onChange={(event) => setLoginPassphrase(event.target.value)}
                  disabled={busy}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  The passphrase shown when this account was created. It's
                  only used on this device to unlock your encrypted data.
                </p>
              </label>
            )}
          </div>

          <div
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={
              status === "error"
                ? "mt-3 flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-2.5 text-[11.5px] leading-relaxed text-destructive"
                : "mt-2 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground"
            }
          >
            <span className="mt-0.5 flex-shrink-0">{statusIcon}</span>
            <span>{message}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {pendingMode ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {mode === "register"
                ? pendingMode
                  ? "Creating account…"
                  : hosted
                    ? "Create free account"
                    : "Create account"
                : pendingMode
                  ? "Connecting…"
                  : "Sign in & sync"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
