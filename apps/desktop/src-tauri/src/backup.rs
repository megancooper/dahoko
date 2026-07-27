use rusqlite::{params, Connection, TransactionBehavior};
use serde::Deserialize;
use std::collections::HashSet;
use tauri::{AppHandle, Manager};

const MAX_TASKS: usize = 50_000;
const MAX_LISTS: usize = 2_000;
const MAX_STATUSES: usize = 100;
const MAX_SUBTASKS: usize = 200_000;
const MAX_COMPLETIONS: usize = 500_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackupData {
    tasks: Vec<BackupTask>,
    lists: Vec<BackupList>,
    statuses: Vec<BackupStatus>,
    subtasks: Vec<BackupSubtask>,
    completions: Vec<BackupCompletion>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BackupTask {
    id: String,
    title: String,
    notes: String,
    due_at: Option<String>,
    has_due_time: bool,
    priority: i64,
    list_id: Option<String>,
    status_id: String,
    tags: Vec<String>,
    recurrence: Option<String>,
    completed_at: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BackupList {
    id: String,
    name: String,
    color: String,
    sort_order: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BackupStatus {
    id: String,
    name: String,
    color: String,
    sort_order: i64,
    is_done: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BackupSubtask {
    id: String,
    task_id: String,
    title: String,
    done: bool,
    sort_order: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BackupCompletion {
    id: String,
    task_id: String,
    due_date: String,
    completed_at: String,
}

fn valid_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && !value.chars().any(char::is_control)
}

fn valid_text(value: &str, max: usize, allow_empty: bool) -> bool {
    (allow_empty || !value.is_empty()) && value.len() <= max
}

fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn valid_optional_text(value: Option<&str>, max: usize) -> bool {
    value.is_none_or(|text| valid_text(text, max, true))
}

fn validate(data: &BackupData) -> bool {
    if data.tasks.len() > MAX_TASKS
        || data.lists.len() > MAX_LISTS
        || data.statuses.is_empty()
        || data.statuses.len() > MAX_STATUSES
        || data.subtasks.len() > MAX_SUBTASKS
        || data.completions.len() > MAX_COMPLETIONS
        || !data.statuses.iter().any(|status| !status.is_done)
    {
        return false;
    }

    let mut status_ids = HashSet::with_capacity(data.statuses.len());
    for status in &data.statuses {
        if !valid_id(&status.id)
            || !status_ids.insert(status.id.as_str())
            || !valid_text(&status.name, 200, false)
            || !valid_color(&status.color)
            || status.sort_order < 0
        {
            return false;
        }
    }

    let mut list_ids = HashSet::with_capacity(data.lists.len());
    for list in &data.lists {
        if !valid_id(&list.id)
            || !list_ids.insert(list.id.as_str())
            || !valid_text(&list.name, 500, false)
            || !valid_color(&list.color)
            || list.sort_order < 0
        {
            return false;
        }
    }

    let mut task_ids = HashSet::with_capacity(data.tasks.len());
    for task in &data.tasks {
        let valid_recurrence = task
            .recurrence
            .as_deref()
            .is_none_or(|value| matches!(value, "daily" | "weekdays" | "weekly" | "monthly"));
        let tags_are_valid = task.tags.len() <= 100
            && task.tags.iter().all(|tag| valid_text(tag, 100, false))
            && task.tags.iter().collect::<HashSet<_>>().len() == task.tags.len();

        if !valid_id(&task.id)
            || !task_ids.insert(task.id.as_str())
            || !valid_text(&task.title, 10_000, false)
            || !valid_text(&task.notes, 1_000_000, true)
            || !valid_optional_text(task.due_at.as_deref(), 64)
            || !valid_optional_text(task.completed_at.as_deref(), 64)
            || !valid_text(&task.created_at, 64, false)
            || !valid_text(&task.updated_at, 64, false)
            || !(0..=3).contains(&task.priority)
            || task.sort_order < 0
            || !status_ids.contains(task.status_id.as_str())
            || task
                .list_id
                .as_deref()
                .is_some_and(|id| !list_ids.contains(id))
            || !valid_recurrence
            || !tags_are_valid
        {
            return false;
        }
    }

    let mut subtask_ids = HashSet::with_capacity(data.subtasks.len());
    for subtask in &data.subtasks {
        if !valid_id(&subtask.id)
            || !subtask_ids.insert(subtask.id.as_str())
            || !task_ids.contains(subtask.task_id.as_str())
            || !valid_text(&subtask.title, 10_000, false)
            || subtask.sort_order < 0
        {
            return false;
        }
    }

    let mut completion_ids = HashSet::with_capacity(data.completions.len());
    let mut completion_dates = HashSet::with_capacity(data.completions.len());
    for completion in &data.completions {
        if !valid_id(&completion.id)
            || !completion_ids.insert(completion.id.as_str())
            || !task_ids.contains(completion.task_id.as_str())
            || !valid_text(&completion.due_date, 10, false)
            || !valid_text(&completion.completed_at, 64, false)
            || !completion_dates.insert((completion.task_id.as_str(), completion.due_date.as_str()))
        {
            return false;
        }
    }

    true
}

fn replace(path: &std::path::Path, data: &BackupData) -> rusqlite::Result<()> {
    let mut connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;

    transaction.execute("DELETE FROM task_completions", [])?;
    transaction.execute("DELETE FROM subtasks", [])?;
    transaction.execute("DELETE FROM task_tags", [])?;
    transaction.execute("DELETE FROM tasks", [])?;
    transaction.execute("DELETE FROM lists", [])?;
    transaction.execute("DELETE FROM statuses", [])?;

    for status in &data.statuses {
        transaction.execute(
            "INSERT INTO statuses (id, name, color, sort_order, is_done) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                status.id,
                status.name,
                status.color,
                status.sort_order,
                status.is_done as i64
            ],
        )?;
    }

    for list in &data.lists {
        transaction.execute(
            "INSERT INTO lists (id, name, color, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![list.id, list.name, list.color, list.sort_order],
        )?;
    }

    for task in &data.tasks {
        transaction.execute(
            "INSERT INTO tasks (
                id, title, notes, due_at, has_due_time, priority, list_id,
                status_id, recurrence, completed_at, sort_order, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                task.id,
                task.title,
                task.notes,
                task.due_at,
                task.has_due_time as i64,
                task.priority,
                task.list_id,
                task.status_id,
                task.recurrence,
                task.completed_at,
                task.sort_order,
                task.created_at,
                task.updated_at
            ],
        )?;
        for tag in &task.tags {
            transaction.execute(
                "INSERT INTO task_tags (task_id, tag) VALUES (?1, ?2)",
                params![task.id, tag],
            )?;
        }
    }

    for subtask in &data.subtasks {
        transaction.execute(
            "INSERT INTO subtasks (id, task_id, title, done, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                subtask.id,
                subtask.task_id,
                subtask.title,
                subtask.done as i64,
                subtask.sort_order
            ],
        )?;
    }

    for completion in &data.completions {
        transaction.execute(
            "INSERT INTO task_completions (id, task_id, due_date, completed_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                completion.id,
                completion.task_id,
                completion.due_date,
                completion.completed_at
            ],
        )?;
    }

    transaction.commit()
}

#[tauri::command]
pub fn replace_all_data(app: AppHandle, data: BackupData) -> Result<(), String> {
    if !validate(&data) {
        return Err("The backup data is invalid.".to_string());
    }

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Unable to open the local database.".to_string())?;
    std::fs::create_dir_all(&directory)
        .map_err(|_| "Unable to open the local database.".to_string())?;
    replace(&directory.join("dahoko.db"), &data)
        .map_err(|_| "The backup could not be imported safely.".to_string())
}
