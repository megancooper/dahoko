package com.dahoko.android.domain

import kotlinx.serialization.Serializable

/**
 * Domain entities. Field names and JSON shape mirror the desktop app's
 * `@dahoko/core` types exactly — these classes are serialized verbatim into
 * the encrypted sync document, and the desktop validator requires every
 * field to be present (nullable fields serialize as explicit nulls).
 */

@Serializable
data class Task(
    val id: String,
    val title: String,
    val notes: String,
    /** ISO date (YYYY-MM-DD) or full ISO datetime; null = no due date */
    val dueAt: String?,
    /** Whether dueAt carries a meaningful time component */
    val hasDueTime: Boolean,
    /** 0 = none, 1 = low, 2 = medium, 3 = high */
    val priority: Int,
    val listId: String?,
    val statusId: String,
    val tags: List<String>,
    /** Repeat cadence; completing a recurring task advances dueAt instead of closing it */
    val recurrence: Recurrence?,
    val completedAt: String?,
    /** Sort key within a status column / list */
    val sortOrder: Long,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
data class TaskList(
    val id: String,
    val name: String,
    val color: String,
    val sortOrder: Long,
)

@Serializable
data class Status(
    val id: String,
    val name: String,
    val color: String,
    val sortOrder: Long,
    /** Tasks moved here are marked completed */
    val isDone: Boolean,
)

@Serializable
data class Subtask(
    val id: String,
    val taskId: String,
    val title: String,
    val done: Boolean,
    val sortOrder: Long,
)

/** One completed occurrence of a recurring task. */
@Serializable
data class Completion(
    val id: String,
    val taskId: String,
    /** The date (YYYY-MM-DD) this occurrence was due */
    val dueDate: String,
    val completedAt: String,
)

@Serializable
data class Workspace(
    val id: String,
    val name: String,
    val color: String,
    val sortOrder: Long,
    val createdAt: String,
)

/** All records of one workspace, mirroring the desktop `RepoSnapshot`. */
data class RepoSnapshot(
    val tasks: List<Task>,
    val lists: List<TaskList>,
    val statuses: List<Status>,
    val subtasks: List<Subtask>,
    val completions: List<Completion>,
)

data class WorkspaceSnapshot(
    val workspace: Workspace,
    val data: RepoSnapshot,
)

val PRIORITY_LABELS = mapOf(0 to "None", 1 to "Low", 2 to "Medium", 3 to "High")

data class DefaultStatus(val name: String, val color: String, val sortOrder: Long, val isDone: Boolean)

val DEFAULT_STATUSES = listOf(
    DefaultStatus("Backlog", "#808FA0", 0, false),
    DefaultStatus("In progress", "#A3D0FF", 1, false),
    DefaultStatus("Done", "#2A7A5C", 2, true),
)
