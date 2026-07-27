ALTER TABLE tasks ADD COLUMN recurrence TEXT;

CREATE TABLE task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    UNIQUE (task_id, due_date)
);

CREATE INDEX idx_completions_task ON task_completions (task_id);
CREATE INDEX idx_completions_due ON task_completions (due_date);
