import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeSettings,
  type Settings,
  type ThemePreference,
} from "./settings-model";
import { setDiagnosticsEnabled } from "@/lib/telemetry";

export {
  DEFAULT_SETTINGS,
  DEFAULT_VIEW_CONTEXTS,
  defaultViewContextForFilter,
  defaultViewForFilter,
  isDefaultView,
  normalizeSettings,
  type DefaultView,
  type DefaultViewContext,
  type DefaultViews,
  type Settings,
  type ThemePreference,
} from "./settings-model";

const SETTINGS_KEY = "dahoko.settings";
/** Theme lives in its own key so the pre-paint script and ThemeToggle share it. */
const THEME_KEY = "dahoko.theme";

function loadSettings(): Settings {
  let stored: unknown = {};
  let storedTheme: string | null = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
    storedTheme = window.localStorage.getItem(THEME_KEY);
  } catch {
    // Corrupt or inaccessible settings fall back to validated defaults.
  }
  return normalizeSettings(stored, storedTheme);
}

function applyTheme(theme: ThemePreference) {
  try {
    if (theme === "system") {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, theme);
    }
  } catch {
    // A denied storage write should not stop the UI from applying the theme.
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
      const next = normalizeSettings(
        {
          ...prev,
          ...patch,
          defaultViews: patch.defaultViews ?? prev.defaultViews,
        },
        patch.theme ?? prev.theme,
      );
      const { theme, ...rest } = next;
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
      } catch {
        // Keep the in-memory preference when local storage is unavailable.
      }
      if (patch.theme !== undefined) applyTheme(theme);
      return next;
    });
  }, []);

  useEffect(() => {
    setDiagnosticsEnabled(settings.shareDiagnostics);
  }, [settings.shareDiagnostics]);

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
