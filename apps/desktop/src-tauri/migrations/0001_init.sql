CREATE TABLE lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#A3D0FF',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#808FA0',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    due_at TEXT,
    has_due_time INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    list_id TEXT REFERENCES lists (id) ON DELETE SET NULL,
    status_id TEXT NOT NULL REFERENCES statuses (id),
    completed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE task_tags (
    task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (task_id, tag)
);

CREATE TABLE subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tasks_status ON tasks (status_id);
CREATE INDEX idx_tasks_list ON tasks (list_id);
CREATE INDEX idx_tasks_due ON tasks (due_at);
CREATE INDEX idx_task_tags_tag ON task_tags (tag);

INSERT INTO statuses (id, name, color, sort_order, is_done) VALUES
    ('status-backlog', 'Backlog', '#808FA0', 0, 0),
    ('status-progress', 'In progress', '#A3D0FF', 1, 0),
    ('status-done', 'Done', '#2A7A5C', 2, 1);
