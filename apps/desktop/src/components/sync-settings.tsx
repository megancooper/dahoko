import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button, Input } from "@dahoko/ui";
import { useSync } from "@/state/sync";

function openExternal(url: string) {
  // Inside the Tauri webview window.open routes through the shell; in the
  // browser build it opens a tab. Callers also surface the URL as a link
  // in case popups are blocked.
  window.open(url, "_blank", "noopener,noreferrer");
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
          end-to-end-encrypted Dahoko Cloud. $4/month or $40/year.
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
                openExternal(await openBillingPortal());
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
              onClick={() =>
                void run(async () => {
                  const url = await startCheckout("monthly");
                  setCheckoutUrl(url);
                  openExternal(url);
                })
              }
            >
              Upgrade · $4/mo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const url = await startCheckout("yearly");
                  setCheckoutUrl(url);
                  openExternal(url);
                })
              }
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
          Checkout opened in your browser. If it didn’t,{" "}
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            open it here
          </a>
          . Your plan refreshes automatically when you return.
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

export function SyncSettings() {
  const {
    status,
    message,
    account,
    savedConfig,
    hostedServerUrl,
    lastSyncedAt,
    connect,
    disconnect,
    deleteAccount,
    syncNow,
  } = useSync();
  const [serverUrl, setServerUrl] = useState(
    savedConfig?.serverUrl || hostedServerUrl,
  );
  const [email, setEmail] = useState(savedConfig?.email ?? "");
  const [password, setPassword] = useState("");
  const [encryptionPassphrase, setEncryptionPassphrase] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const busy = status === "connecting" || status === "syncing";

  useEffect(() => {
    if (savedConfig?.serverUrl) setServerUrl(savedConfig.serverUrl);
    if (savedConfig?.email) setEmail(savedConfig.email);
  }, [savedConfig?.email, savedConfig?.serverUrl]);

  const submit = async (mode: "register" | "login") => {
    try {
      await connect({
        mode,
        serverUrl,
        email,
        password,
        encryptionPassphrase,
      });
      setPassword("");
      setEncryptionPassphrase("");
    } catch {
      // The provider exposes a safe, actionable message in this section.
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
        <div className="mt-3">
          {hostedServerUrl && serverUrl !== hostedServerUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mb-3"
              onClick={() => setServerUrl(hostedServerUrl)}
            >
              <Cloud aria-hidden="true" className="h-3.5 w-3.5" />
              Use Dahoko Cloud
            </Button>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
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

            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                Account password
              </span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                Encryption passphrase
              </span>
              <Input
                type="password"
                autoComplete="off"
                value={encryptionPassphrase}
                onChange={(event) =>
                  setEncryptionPassphrase(event.target.value)
                }
                disabled={busy}
              />
            </label>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Use two different secrets. Your encryption passphrase never leaves
            this device and is remembered only for this app session. If you
            lose it, nobody can recover the encrypted server copy.
          </p>

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
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submit("login")}
            >
              {status === "connecting" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {status === "connecting" ? "Connecting…" : "Sign in & sync"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void submit("register")}
            >
              {status === "connecting" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : null}
              Create account
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
