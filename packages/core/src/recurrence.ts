export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

function parseDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

function fmtDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The next due date (YYYY-MM-DD) after `fromIso` for the given cadence. */
export function nextOccurrence(fromIso: string, recurrence: Recurrence): string {
  const d = parseDay(fromIso);
  switch (recurrence) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekdays":
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly": {
      // Clamp to the last day of the next month (Jan 31 -> Feb 28).
      const dayOfMonth = d.getDate();
      const lastOfNext = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(dayOfMonth, lastOfNext.getDate()));
      break;
    }
  }
  return fmtDay(d);
}

/**
 * Whether a task anchored at `anchorIso` (its due date) is scheduled on
 * `dayIso` under the given cadence.
 */
export function isScheduledOn(
  anchorIso: string,
  recurrence: Recurrence,
  dayIso: string,
): boolean {
  const anchor = parseDay(anchorIso);
  const day = parseDay(dayIso);
  switch (recurrence) {
    case "daily":
      return true;
    case "weekdays":
      return day.getDay() >= 1 && day.getDay() <= 5;
    case "weekly":
      return day.getDay() === anchor.getDay();
    case "monthly":
      return day.getDate() === anchor.getDate();
  }
}
