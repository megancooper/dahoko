import { Check } from "lucide-react";
import { VersionBadge, cn } from "@dahoko/ui";
import { isTauri } from "@/db";
import { useUpdater } from "@/state/updater";

/**
 * Custom window title bar. In Tauri the native bar is hidden (overlay
 * style), so this strip doubles as the drag region; the extra left padding
 * clears the macOS traffic lights.
 */
export function TitleBar() {
  const { version } = useUpdater();

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "flex h-9 flex-shrink-0 select-none items-center justify-end gap-2 border-b border-border bg-muted/50 px-3.5",
        isTauri() && "pl-[84px]",
      )}
    >
      <span className="pointer-events-none grid h-[18px] w-[18px] place-items-center rounded-md border border-primary-strong/30 bg-primary text-primary-foreground">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="pointer-events-none font-brand text-[13.5px] font-semibold tracking-tight">
        dahoko
      </span>
      <VersionBadge version={version} className="pointer-events-none" />
    </header>
  );
}
