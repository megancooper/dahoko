import { CalendarDays, Clock, Flag, Repeat, Tag } from "lucide-react";
import type { QuickAddResult } from "@dahoko/core";
import { PRIORITY_LABELS, RECURRENCE_LABELS } from "@dahoko/core";
import { cn } from "@dahoko/ui";

function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Chip({
  icon,
  label,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "brand" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "brand" &&
          "border-primary-strong/25 bg-primary/15 text-primary-strong",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "neutral" &&
          "border-border bg-muted text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * Live preview of what quick-add syntax was recognized in a title, so
 * "call mom tomorrow 15:00 #family !high" visibly becomes structured data
 * before the task is created.
 */
export function ParsedTokenChips({
  parsed,
  className,
}: {
  parsed: QuickAddResult;
  className?: string;
}) {
  const iconClass = "h-3 w-3";
  const hasTokens =
    parsed.dueDate !== null ||
    parsed.priority !== 0 ||
    parsed.recurrence !== null ||
    parsed.tags.length > 0;
  if (!hasTokens) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {parsed.dueDate ? (
        <Chip
          tone="brand"
          icon={<CalendarDays className={iconClass} />}
          label={friendlyDate(parsed.dueDate)}
        />
      ) : null}
      {parsed.dueTime ? (
        <Chip
          tone="brand"
          icon={<Clock className={iconClass} />}
          label={parsed.dueTime}
        />
      ) : null}
      {parsed.recurrence ? (
        <Chip
          icon={<Repeat className={iconClass} />}
          label={RECURRENCE_LABELS[parsed.recurrence]}
        />
      ) : null}
      {parsed.priority !== 0 ? (
        <Chip
          tone={
            parsed.priority === 3
              ? "danger"
              : parsed.priority === 2
                ? "warning"
                : "neutral"
          }
          icon={<Flag className={iconClass} />}
          label={PRIORITY_LABELS[parsed.priority]}
        />
      ) : null}
      {parsed.tags.map((tag) => (
        <Chip key={tag} icon={<Tag className={iconClass} />} label={`#${tag}`} />
      ))}
    </div>
  );
}
