CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#A3D0FF',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

INSERT INTO workspaces (id, name, color, sort_order, created_at)
VALUES (
    'workspace-personal',
    'Personal',
    '#A3D0FF',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

ALTER TABLE lists
    ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace-personal';
ALTER TABLE statuses
    ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace-personal';
ALTER TABLE tasks
    ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace-personal';
ALTER TABLE subtasks
    ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace-personal';
ALTER TABLE task_completions
    ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'workspace-personal';

CREATE INDEX idx_lists_workspace ON lists (workspace_id, sort_order);
CREATE INDEX idx_statuses_workspace ON statuses (workspace_id, sort_order);
CREATE INDEX idx_tasks_workspace ON tasks (workspace_id, sort_order);
CREATE INDEX idx_subtasks_workspace ON subtasks (workspace_id, sort_order);
CREATE INDEX idx_completions_workspace
    ON task_completions (workspace_id, due_date);
