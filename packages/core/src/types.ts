export type Priority = 0 | 1 | 2 | 3; // 0 = none, 1 = low, 2 = medium, 3 = high

export interface Task {
  id: string;
  title: string;
  notes: string;
  /** ISO date (YYYY-MM-DD) or full ISO datetime; null = no due date */
  dueAt: string | null;
  /** Whether dueAt carries a meaningful time component */
  hasDueTime: boolean;
  priority: Priority;
  listId: string | null;
  statusId: string;
  tags: string[];
  completedAt: string | null;
  /** Sort key within a status column / list */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  /** Tasks moved here are marked completed */
  isDone: boolean;
}

export interface Tag {
  name: string;
  color: string | null;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
};

export const DEFAULT_STATUSES: Omit<Status, "id">[] = [
  { name: "Backlog", color: "#808FA0", sortOrder: 0, isDone: false },
  { name: "In progress", color: "#A3D0FF", sortOrder: 1, isDone: false },
  { name: "Done", color: "#2A7A5C", sortOrder: 2, isDone: true },
];
