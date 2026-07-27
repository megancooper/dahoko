import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type DefaultView = "list" | "board" | "tags";

export interface Settings {
  theme: ThemePreference;
  defaultView: DefaultView;
  /** Keep tasks completed today visible in the Inbox */
  showCompletedInInbox: boolean;
}

const SETTINGS_KEY = "dahoko.settings";
/** Theme lives in its own key so the pre-paint script and ThemeToggle share it. */
const THEME_KEY = "dahoko.theme";

const DEFAULTS: Settings = {
  theme: "system",
  defaultView: "list",
  showCompletedInInbox: true,
};

function loadSettings(): Settings {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    // Corrupt settings fall back to defaults.
  }
  const storedTheme = window.localStorage.getItem(THEME_KEY);
  const theme: ThemePreference =
    storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
  return { ...DEFAULTS, ...stored, theme };
}

function applyTheme(theme: ThemePreference) {
  if (theme === "system") {
    window.localStorage.removeItem(THEME_KEY);
  } else {
    window.localStorage.setItem(THEME_KEY, theme);
  }
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

interface SettingsValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const { theme, ...rest } = next;
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
      if (patch.theme !== undefined) applyTheme(theme);
      return next;
    });
  }, []);

  // Follow OS theme changes while in system mode.
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      document.documentElement.classList.toggle("dark", mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within SettingsProvider");
  return value;
}
