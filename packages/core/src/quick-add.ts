import type { Priority } from "./types";

export interface QuickAddResult {
  title: string;
  tags: string[];
  priority: Priority;
  /** ISO date (YYYY-MM-DD), no time component */
  dueDate: string | null;
  /** HH:MM if a time was given alongside a date word */
  dueTime: string | null;
}

const PRIORITY_RE = /(?:^|\s)!(?:p([123])|(high|med|medium|low))(?=\s|$)/i;
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
const TIME_RE = /(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DateMatch {
  index: number;
  length: number;
  date: string;
}

/** Finds the last natural-language date reference in the text. */
function findDate(text: string, now: Date): DateMatch | null {
  const lower = text.toLowerCase();
  let best: DateMatch | null = null;

  const consider = (index: number, length: number, date: Date) => {
    if (index < 0) return;
    if (!best || index > best.index) {
      best = { index, length, date: toIsoDate(date) };
    }
  };

  const simple: Array<[string, number]> = [
    ["today", 0],
    ["tomorrow", 1],
    ["tmr", 1],
  ];
  for (const [word, offset] of simple) {
    const re = new RegExp(`(?:^|\\s)${word}(?=\\s|$)`, "i");
    const m = re.exec(lower);
    if (m) {
      const idx = m.index + (m[0].length - word.length);
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      consider(idx, word.length, d);
    }
  }

  const weekdayRe = new RegExp(
    `(?:^|\\s)(next\\s+)?(${WEEKDAYS.join("|")}|${WEEKDAYS.map((w) => w.slice(0, 3)).join("|")})(?=\\s|$)`,
    "i",
  );
  const wm = weekdayRe.exec(lower);
  if (wm) {
    const token = wm[2];
    const target = WEEKDAYS.findIndex((w) => w.startsWith(token.slice(0, 3)));
    if (target >= 0) {
      const d = new Date(now);
      let delta = (target - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "monday" on a Monday means next week
      if (wm[1]) delta += 7; // "next monday" skips the coming one
      d.setDate(d.getDate() + delta);
      consider(wm.index === 0 ? 0 : wm.index + 1, wm[0].trim().length, d);
    }
  }

  // Explicit ISO date: 2026-08-01
  const isoRe = /(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/;
  const im = isoRe.exec(text);
  if (im) {
    const d = new Date(Number(im[1]), Number(im[2]) - 1, Number(im[3]));
    consider(im.index === 0 ? 0 : im.index + 1, im[0].trim().length, d);
  }

  return best;
}

/**
 * Parses quick-add syntax: "Buy milk tomorrow at 15:00 #errand !p2".
 * Date words, #tags, and !priority markers are stripped from the title.
 */
export function parseQuickAdd(input: string, now = new Date()): QuickAddResult {
  let text = input.trim();

  let priority: Priority = 0;
  const pm = PRIORITY_RE.exec(text);
  if (pm) {
    if (pm[1]) priority = Number(pm[1]) as Priority;
    else {
      const word = pm[2].toLowerCase();
      priority = word === "high" ? 3 : word === "low" ? 1 : 2;
    }
    text = text.replace(PRIORITY_RE, " ");
  }

  const tags: string[] = [];
  text = text.replace(TAG_RE, (_m, tag: string) => {
    tags.push(tag.toLowerCase());
    return " ";
  });

  let dueTime: string | null = null;
  const dateMatch = findDate(text, now);
  let dueDate: string | null = null;
  if (dateMatch) {
    dueDate = dateMatch.date;
    text =
      text.slice(0, dateMatch.index) +
      text.slice(dateMatch.index + dateMatch.length);
    const tm = TIME_RE.exec(text);
    if (tm) {
      dueTime = `${tm[1].padStart(2, "0")}:${tm[2]}`;
      text = text.replace(TIME_RE, " ");
    }
  }

  const title = text.replace(/\s+/g, " ").trim();
  return { title, tags, priority, dueDate, dueTime };
}
