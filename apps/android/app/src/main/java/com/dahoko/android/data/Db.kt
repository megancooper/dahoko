package com.dahoko.android.data

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/**
 * Local schema mirroring the desktop app's SQLite migrations so a sync
 * snapshot maps 1:1 onto rows.
 */

@Entity(tableName = "workspaces")
data class WorkspaceEntity(
    @PrimaryKey val id: String,
    val name: String,
    val color: String,
    @ColumnInfo(name = "sort_order") val sortOrder: Long,
    @ColumnInfo(name = "created_at") val createdAt: String,
)

@Entity(
    tableName = "lists",
    indices = [Index("workspace_id")],
)
data class ListEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val name: String,
    val color: String,
    @ColumnInfo(name = "sort_order") val sortOrder: Long,
)

@Entity(
    tableName = "statuses",
    indices = [Index("workspace_id")],
)
data class StatusEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val name: String,
    val color: String,
    @ColumnInfo(name = "sort_order") val sortOrder: Long,
    @ColumnInfo(name = "is_done") val isDone: Boolean,
)

@Entity(
    tableName = "tasks",
    indices = [Index("workspace_id"), Index("status_id"), Index("list_id"), Index("due_at")],
)
data class TaskEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val title: String,
    val notes: String,
    @ColumnInfo(name = "due_at") val dueAt: String?,
    @ColumnInfo(name = "has_due_time") val hasDueTime: Boolean,
    val priority: Int,
    @ColumnInfo(name = "list_id") val listId: String?,
    @ColumnInfo(name = "status_id") val statusId: String,
    val recurrence: String?,
    @ColumnInfo(name = "completed_at") val completedAt: String?,
    @ColumnInfo(name = "sort_order") val sortOrder: Long,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
)

@Entity(
    tableName = "task_tags",
    primaryKeys = ["task_id", "tag"],
    foreignKeys = [
        ForeignKey(
            entity = TaskEntity::class,
            parentColumns = ["id"],
            childColumns = ["task_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("tag")],
)
data class TaskTagEntity(
    @ColumnInfo(name = "task_id") val taskId: String,
    val tag: String,
)

@Entity(
    tableName = "subtasks",
    foreignKeys = [
        ForeignKey(
            entity = TaskEntity::class,
            parentColumns = ["id"],
            childColumns = ["task_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("task_id"), Index("workspace_id")],
)
data class SubtaskEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    @ColumnInfo(name = "task_id") val taskId: String,
    val title: String,
    val done: Boolean,
    @ColumnInfo(name = "sort_order") val sortOrder: Long,
)

@Entity(
    tableName = "task_completions",
    foreignKeys = [
        ForeignKey(
            entity = TaskEntity::class,
            parentColumns = ["id"],
            childColumns = ["task_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index("task_id"),
        Index("workspace_id"),
        Index(value = ["task_id", "due_date"], unique = true),
    ],
)
data class CompletionEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    @ColumnInfo(name = "task_id") val taskId: String,
    @ColumnInfo(name = "due_date") val dueDate: String,
    @ColumnInfo(name = "completed_at") val completedAt: String,
)

@Dao
interface DahokoDao {
    @Query("SELECT * FROM workspaces ORDER BY sort_order, id")
    fun observeWorkspaces(): Flow<List<WorkspaceEntity>>

    @Query("SELECT * FROM workspaces ORDER BY sort_order, id")
    suspend fun workspaces(): List<WorkspaceEntity>

    @Query("SELECT * FROM lists WHERE workspace_id = :workspaceId ORDER BY sort_order, id")
    fun observeLists(workspaceId: String): Flow<List<ListEntity>>

    @Query("SELECT * FROM statuses WHERE workspace_id = :workspaceId ORDER BY sort_order, id")
    fun observeStatuses(workspaceId: String): Flow<List<StatusEntity>>

    @Query("SELECT * FROM tasks WHERE workspace_id = :workspaceId ORDER BY sort_order, id")
    fun observeTasks(workspaceId: String): Flow<List<TaskEntity>>

    @Query(
        "SELECT task_tags.* FROM task_tags JOIN tasks ON tasks.id = task_tags.task_id " +
            "WHERE tasks.workspace_id = :workspaceId",
    )
    fun observeTags(workspaceId: String): Flow<List<TaskTagEntity>>

    @Query("SELECT * FROM subtasks WHERE workspace_id = :workspaceId ORDER BY sort_order, id")
    fun observeSubtasks(workspaceId: String): Flow<List<SubtaskEntity>>

    @Query("SELECT * FROM task_completions WHERE workspace_id = :workspaceId ORDER BY due_date, id")
    fun observeCompletions(workspaceId: String): Flow<List<CompletionEntity>>

    @Query("SELECT * FROM lists ORDER BY sort_order, id")
    suspend fun allLists(): List<ListEntity>

    @Query("SELECT * FROM statuses ORDER BY sort_order, id")
    suspend fun allStatuses(): List<StatusEntity>

    @Query("SELECT * FROM tasks ORDER BY sort_order, id")
    suspend fun allTasks(): List<TaskEntity>

    @Query("SELECT * FROM task_tags ORDER BY task_id, tag")
    suspend fun allTags(): List<TaskTagEntity>

    @Query("SELECT * FROM subtasks ORDER BY sort_order, id")
    suspend fun allSubtasks(): List<SubtaskEntity>

    @Query("SELECT * FROM task_completions ORDER BY due_date, id")
    suspend fun allCompletions(): List<CompletionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertWorkspace(workspace: WorkspaceEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertList(list: ListEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertStatus(status: StatusEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTask(task: TaskEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSubtask(subtask: SubtaskEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCompletion(completion: CompletionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTags(tags: List<TaskTagEntity>)

    @Query("DELETE FROM task_tags WHERE task_id = :taskId")
    suspend fun deleteTagsForTask(taskId: String)

    @Query("DELETE FROM tasks WHERE id = :taskId")
    suspend fun deleteTask(taskId: String)

    @Query("DELETE FROM subtasks WHERE id = :subtaskId")
    suspend fun deleteSubtask(subtaskId: String)

    @Query("DELETE FROM lists WHERE id = :listId")
    suspend fun deleteList(listId: String)

    @Query("DELETE FROM task_completions WHERE task_id = :taskId AND due_date = :dueDate")
    suspend fun deleteCompletion(taskId: String, dueDate: String)

    @Query("DELETE FROM workspaces")
    suspend fun clearWorkspaces()

    @Query("DELETE FROM tasks")
    suspend fun clearTasks()

    @Query("DELETE FROM lists")
    suspend fun clearLists()

    @Query("DELETE FROM statuses")
    suspend fun clearStatuses()

    @Query("DELETE FROM task_tags")
    suspend fun clearTags()

    @Query("DELETE FROM subtasks")
    suspend fun clearSubtasks()

    @Query("DELETE FROM task_completions")
    suspend fun clearCompletions()

    @Transaction
    suspend fun replaceAll(
        workspaces: List<WorkspaceEntity>,
        lists: List<ListEntity>,
        statuses: List<StatusEntity>,
        tasks: List<TaskEntity>,
        tags: List<TaskTagEntity>,
        subtasks: List<SubtaskEntity>,
        completions: List<CompletionEntity>,
    ) {
        clearCompletions()
        clearSubtasks()
        clearTags()
        clearTasks()
        clearLists()
        clearStatuses()
        clearWorkspaces()
        workspaces.forEach { upsertWorkspace(it) }
        statuses.forEach { upsertStatus(it) }
        lists.forEach { upsertList(it) }
        tasks.forEach { upsertTask(it) }
        insertTags(tags)
        subtasks.forEach { upsertSubtask(it) }
        completions.forEach { upsertCompletion(it) }
    }
}

@Database(
    entities = [
        WorkspaceEntity::class,
        ListEntity::class,
        StatusEntity::class,
        TaskEntity::class,
        TaskTagEntity::class,
        SubtaskEntity::class,
        CompletionEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class DahokoDb : RoomDatabase() {
    abstract fun dao(): DahokoDao
}
