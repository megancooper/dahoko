import { useMemo } from "react";
import { Clock, Flame } from "lucide-react";
import type { Task } from "@dahoko/core";
import { RECURRENCE_LABELS, isScheduledOn } from "@dahoko/core";
import { cn } from "@dahoko/ui";
import type { Completion } from "@/db";
import { useStore } from "@/state/store";

const DAY_MS = 86_400_000;
const GRID_WEEKS = 12;
const STATS_WINDOW_DAYS = 30;

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The local calendar day a task was created (createdAt is a UTC timestamp). */
function createdDay(task: Task): string {
  return isoDay(new Date(task.createdAt));
}

/** Days a task is scheduled on, respecting its creation date. */
function scheduledOn(task: Task, dayIso: string): boolean {
  if (dayIso < createdDay(task)) return false;
  const anchor = task.dueAt ?? dayIso;
  return isScheduledOn(anchor, task.recurrence!, dayIso);
}

interface DayCell {
  iso: string;
  scheduled: number;
  done: number;
  future: boolean;
}

function HeatGrid({
  tasks,
  doneSet,
}: {
  tasks: Task[];
  doneSet: Set<string>;
}) {
  const today = startOfToday();
  const todayIso = isoDay(today);
  // Columns are weeks starting Monday; the last column contains today.
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(today.getTime() - (dow + (GRID_WEEKS - 1) * 7) * DAY_MS);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < GRID_WEEKS; w += 1) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      const iso = isoDay(date);
      const future = iso > todayIso;
      let scheduled = 0;
      let done = 0;
      if (!future) {
        for (const task of tasks) {
          if (!scheduledOn(task, iso)) continue;
          scheduled += 1;
          if (doneSet.has(`${task.id}:${iso}`)) done += 1;
        }
      }
      week.push({ iso, scheduled, done, future });
    }
    weeks.push(week);
  }

  const cellClass = (cell: DayCell): string => {
    if (cell.future) return "bg-transparent";
    if (cell.scheduled === 0) return "bg-muted/50";
    const ratio = cell.done / cell.scheduled;
    if (ratio === 0) return "bg-muted border border-border/60";
    if (ratio < 1) return "bg-success/40";
    return "bg-success";
  };

  const dayLabels = ["M", "", "W", "", "F", "", ""];

  return (
    <div className="flex gap-1.5">
      <div className="grid grid-rows-7 gap-[3px] pr-0.5">
        {dayLabels.map((label, i) => (
          <span
            key={i}
            className="flex h-[11px] w-3 items-center font-mono text-[9px] leading-none text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>
      {weeks.map((week, w) => (
        <div key={w} className="grid grid-rows-7 gap-[3px]">
          {week.map((cell) => (
            <span
              key={cell.iso}
              title={
                cell.future
                  ? undefined
                  : `${cell.iso} — ${cell.done}/${cell.scheduled} done`
              }
              className={cn("h-[11px] w-[11px] rounded-[3px]", cellClass(cell))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface TaskStats {
  task: Task;
  rate: number;
  doneCount: number;
  scheduledCount: number;
  streak: number;
  avgDelayDays: number | null;
}

function computeStats(
  task: Task,
  completions: Completion[],
  doneSet: Set<string>,
): TaskStats {
  const today = startOfToday();
  const todayIso = isoDay(today);

  let scheduledCount = 0;
  let doneCount = 0;
  for (let i = 0; i < STATS_WINDOW_DAYS; i += 1) {
    const iso = isoDay(new Date(today.getTime() - i * DAY_MS));
    if (!scheduledOn(task, iso)) continue;
    scheduledCount += 1;
    if (doneSet.has(`${task.id}:${iso}`)) doneCount += 1;
  }

  // Streak: consecutive scheduled days completed, walking back from today.
  // A still-pending today doesn't break the streak.
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const iso = isoDay(new Date(today.getTime() - i * DAY_MS));
    if (iso < createdDay(task)) break;
    if (!scheduledOn(task, iso)) continue;
    if (doneSet.has(`${task.id}:${iso}`)) {
      streak += 1;
    } else if (iso === todayIso) {
      continue;
    } else {
      break;
    }
  }

  const mine = completions.filter(
    (c) =>
      c.taskId === task.id &&
      c.dueDate >= isoDay(new Date(today.getTime() - STATS_WINDOW_DAYS * DAY_MS)),
  );
  let avgDelayDays: number | null = null;
  if (mine.length > 0) {
    const total = mine.reduce((sum, c) => {
      const done = new Date(`${c.completedAt.slice(0, 10)}T00:00:00`);
      const due = new Date(`${c.dueDate}T00:00:00`);
      return sum + Math.max(0, (done.getTime() - due.getTime()) / DAY_MS);
    }, 0);
    avgDelayDays = total / mine.length;
  }

  return {
    task,
    rate: scheduledCount > 0 ? doneCount / scheduledCount : 0,
    doneCount,
    scheduledCount,
    streak,
    avgDelayDays,
  };
}

export function RecurringMetrics() {
  const { tasks, completions } = useStore();

  const recurring = useMemo(
    () => tasks.filter((t) => t.recurrence !== null),
    [tasks],
  );
  const doneSet = useMemo(
    () => new Set(completions.map((c) => `${c.taskId}:${c.dueDate}`)),
    [completions],
  );
  const stats = useMemo(
    () => recurring.map((t) => computeStats(t, completions, doneSet)),
    [recurring, completions, doneSet],
  );

  if (recurring.length === 0) return null;

  return (
    <section className="mx-3 mb-1 mt-4 animate-fade-in-up rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Consistency
        </h2>
        <span className="text-[11px] text-muted-foreground">
          last {GRID_WEEKS} weeks
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <HeatGrid tasks={recurring} doneSet={doneSet} />
      </div>

      <div className="mt-4 flex flex-col gap-2.5 border-t border-border pt-3.5">
        {stats.map(({ task, rate, doneCount, scheduledCount, streak, avgDelayDays }) => (
          <div key={task.id} className="flex items-center gap-3">
            <span className="w-[190px] flex-shrink-0 truncate text-[13px]">
              {task.title}
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {RECURRENCE_LABELS[task.recurrence!]}
              </span>
            </span>
            <div className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out-strong",
                  rate >= 0.8
                    ? "bg-success"
                    : rate >= 0.5
                      ? "bg-primary"
                      : "bg-warning",
                )}
                style={{ width: `${Math.round(rate * 100)}%` }}
              />
            </div>
            <span className="w-14 flex-shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {doneCount}/{scheduledCount}
            </span>
            <span
              title="Current streak"
              className="flex w-12 flex-shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground"
            >
              <Flame className="h-3 w-3 text-warning" />
              {streak}
            </span>
            <span
              title="Average delay between due date and completion"
              className="flex w-20 flex-shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground"
            >
              <Clock className="h-3 w-3" />
              {avgDelayDays === null
                ? "—"
                : avgDelayDays < 0.25
                  ? "on time"
                  : `+${avgDelayDays.toFixed(1)}d`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
