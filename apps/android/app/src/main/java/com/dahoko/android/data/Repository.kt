package com.dahoko.android.data

import com.dahoko.android.domain.Completion
import com.dahoko.android.domain.DEFAULT_STATUSES
import com.dahoko.android.domain.Recurrence
import com.dahoko.android.domain.RepoSnapshot
import com.dahoko.android.domain.Status
import com.dahoko.android.domain.Subtask
import com.dahoko.android.domain.Task
import com.dahoko.android.domain.TaskList
import com.dahoko.android.domain.Workspace
import com.dahoko.android.domain.WorkspaceSnapshot
import com.dahoko.android.domain.nextOccurrence
import java.time.Instant
import java.util.UUID

const val DEFAULT_WORKSPACE_ID = "workspace-personal"

fun nowIso(): String = Instant.now().toString()

class Repository(private val db: DahokoDb) {
    val dao: DahokoDao get() = db.dao()

    suspend fun ensureSeeded() {
        if (dao.workspaces().isNotEmpty()) return
        dao.upsertWorkspace(
            WorkspaceEntity(DEFAULT_WORKSPACE_ID, "Personal", "#A3D0FF", 0, nowIso()),
        )
        DEFAULT_STATUSES.forEachIndexed { index, status ->
            dao.upsertStatus(
                StatusEntity(
                    id = defaultStatusId(index),
                    workspaceId = DEFAULT_WORKSPACE_ID,
                    name = status.name,
                    color = status.color,
                    sortOrder = status.sortOrder,
                    isDone = status.isDone,
                ),
            )
        }
    }

    private fun defaultStatusId(index: Int) =
        listOf("status-backlog", "status-progress", "status-done")[index]

    suspend fun createTask(
        workspaceId: String,
        title: String,
        notes: String = "",
        dueAt: String? = null,
        hasDueTime: Boolean = false,
        priority: Int = 0,
        listId: String? = null,
        statusId: String,
        tags: List<String> = emptyList(),
        recurrence: Recurrence? = null,
        sortOrder: Long,
    ): String {
        val id = UUID.randomUUID().toString()
        val now = nowIso()
        dao.upsertTask(
            TaskEntity(
                id = id,
                workspaceId = workspaceId,
                title = title,
                notes = notes,
                dueAt = dueAt,
                hasDueTime = hasDueTime,
                priority = priority,
                listId = listId,
                statusId = statusId,
                recurrence = recurrence?.wireName,
                completedAt = null,
                sortOrder = sortOrder,
                createdAt = now,
                updatedAt = now,
            ),
        )
        if (tags.isNotEmpty()) {
            dao.insertTags(tags.distinct().map { TaskTagEntity(id, it) })
        }
        return id
    }

    suspend fun updateTask(task: TaskEntity, tags: List<String>) {
        dao.upsertTask(task.copy(updatedAt = nowIso()))
        dao.deleteTagsForTask(task.id)
        if (tags.isNotEmpty()) {
            dao.insertTags(tags.distinct().map { TaskTagEntity(task.id, it) })
        }
    }

    /**
     * Completing a recurring task records the occurrence and advances its due
     * date; completing a plain task stamps completedAt and moves it to the
     * first done status.
     */
    suspend fun completeTask(task: TaskEntity, doneStatusId: String?) {
        val now = nowIso()
        val recurrence = Recurrence.fromWire(task.recurrence)
        if (recurrence != null && task.dueAt != null) {
            val dueDate = task.dueAt.take(10)
            dao.upsertCompletion(
                CompletionEntity(
                    id = UUID.randomUUID().toString(),
                    workspaceId = task.workspaceId,
                    taskId = task.id,
                    dueDate = dueDate,
                    completedAt = now,
                ),
            )
            val nextDate = nextOccurrence(dueDate, recurrence)
            val nextDueAt = if (task.hasDueTime && task.dueAt.length > 10) {
                nextDate + task.dueAt.substring(10)
            } else {
                nextDate
            }
            dao.upsertTask(task.copy(dueAt = nextDueAt, updatedAt = now))
        } else {
            dao.upsertTask(
                task.copy(
                    completedAt = now,
                    statusId = doneStatusId ?: task.statusId,
                    updatedAt = now,
                ),
            )
        }
    }

    suspend fun uncompleteTask(task: TaskEntity, openStatusId: String?) {
        dao.upsertTask(
            task.copy(
                completedAt = null,
                statusId = openStatusId ?: task.statusId,
                updatedAt = nowIso(),
            ),
        )
    }

    suspend fun deleteTask(taskId: String) = dao.deleteTask(taskId)

    suspend fun createList(workspaceId: String, name: String, color: String, sortOrder: Long): String {
        val id = UUID.randomUUID().toString()
        dao.upsertList(ListEntity(id, workspaceId, name, color, sortOrder))
        return id
    }

    // --- Sync snapshot mapping -------------------------------------------

    suspend fun buildBundleSnapshot(): List<WorkspaceSnapshot> {
        val workspaces = dao.workspaces()
        val lists = dao.allLists()
        val statuses = dao.allStatuses()
        val tasks = dao.allTasks()
        val tags = dao.allTags().groupBy({ it.taskId }, { it.tag })
        val subtasks = dao.allSubtasks()
        val completions = dao.allCompletions()

        return workspaces.map { workspace ->
            WorkspaceSnapshot(
                workspace = Workspace(
                    workspace.id, workspace.name, workspace.color,
                    workspace.sortOrder, workspace.createdAt,
                ),
                data = RepoSnapshot(
                    tasks = tasks.filter { it.workspaceId == workspace.id }.map { entity ->
                        Task(
                            id = entity.id,
                            title = entity.title,
                            notes = entity.notes,
                            dueAt = entity.dueAt,
                            hasDueTime = entity.hasDueTime,
                            priority = entity.priority,
                            listId = entity.listId,
                            statusId = entity.statusId,
                            tags = tags[entity.id]?.sorted() ?: emptyList(),
                            recurrence = Recurrence.fromWire(entity.recurrence),
                            completedAt = entity.completedAt,
                            sortOrder = entity.sortOrder,
                            createdAt = entity.createdAt,
                            updatedAt = entity.updatedAt,
                        )
                    },
                    lists = lists.filter { it.workspaceId == workspace.id }.map {
                        TaskList(it.id, it.name, it.color, it.sortOrder)
                    },
                    statuses = statuses.filter { it.workspaceId == workspace.id }.map {
                        Status(it.id, it.name, it.color, it.sortOrder, it.isDone)
                    },
                    subtasks = subtasks.filter { it.workspaceId == workspace.id }.map {
                        Subtask(it.id, it.taskId, it.title, it.done, it.sortOrder)
                    },
                    completions = completions.filter { it.workspaceId == workspace.id }.map {
                        Completion(it.id, it.taskId, it.dueDate, it.completedAt)
                    },
                ),
            )
        }
    }

    suspend fun applyBundleSnapshot(snapshots: List<WorkspaceSnapshot>) {
        val workspaces = mutableListOf<WorkspaceEntity>()
        val lists = mutableListOf<ListEntity>()
        val statuses = mutableListOf<StatusEntity>()
        val tasks = mutableListOf<TaskEntity>()
        val tags = mutableListOf<TaskTagEntity>()
        val subtasks = mutableListOf<SubtaskEntity>()
        val completions = mutableListOf<CompletionEntity>()

        for (entry in snapshots) {
            val workspaceId = entry.workspace.id
            workspaces.add(
                WorkspaceEntity(
                    workspaceId, entry.workspace.name, entry.workspace.color,
                    entry.workspace.sortOrder, entry.workspace.createdAt,
                ),
            )
            entry.data.statuses.forEach {
                statuses.add(StatusEntity(it.id, workspaceId, it.name, it.color, it.sortOrder, it.isDone))
            }
            entry.data.lists.forEach {
                lists.add(ListEntity(it.id, workspaceId, it.name, it.color, it.sortOrder))
            }
            entry.data.tasks.forEach { task ->
                tasks.add(
                    TaskEntity(
                        id = task.id,
                        workspaceId = workspaceId,
                        title = task.title,
                        notes = task.notes,
                        dueAt = task.dueAt,
                        hasDueTime = task.hasDueTime,
                        priority = task.priority,
                        listId = task.listId,
                        statusId = task.statusId,
                        recurrence = task.recurrence?.wireName,
                        completedAt = task.completedAt,
                        sortOrder = task.sortOrder,
                        createdAt = task.createdAt,
                        updatedAt = task.updatedAt,
                    ),
                )
                task.tags.forEach { tag -> tags.add(TaskTagEntity(task.id, tag)) }
            }
            entry.data.subtasks.forEach {
                subtasks.add(SubtaskEntity(it.id, workspaceId, it.taskId, it.title, it.done, it.sortOrder))
            }
            entry.data.completions.forEach {
                completions.add(CompletionEntity(it.id, workspaceId, it.taskId, it.dueDate, it.completedAt))
            }
        }
        dao.replaceAll(workspaces, lists, statuses, tasks, tags, subtasks, completions)
    }
}
