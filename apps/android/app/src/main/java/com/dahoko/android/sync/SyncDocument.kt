package com.dahoko.android.sync

import com.dahoko.android.domain.Completion
import com.dahoko.android.domain.RepoSnapshot
import com.dahoko.android.domain.Status
import com.dahoko.android.domain.Subtask
import com.dahoko.android.domain.Task
import com.dahoko.android.domain.TaskList
import com.dahoko.android.domain.Workspace
import com.dahoko.android.domain.WorkspaceSnapshot
import kotlinx.serialization.Serializable

/**
 * Port of the desktop sync document model (sync/document.ts + bundle.ts).
 * Each entity is a last-writer-wins register stamped with a hybrid logical
 * clock; deleted records become tombstones (value = null). The JSON shape is
 * shared with the desktop app and must not drift.
 */

const val SYNC_FORMAT = "dahoko-sync"
const val SYNC_VERSION = 1
const val SYNC_BUNDLE_FORMAT = "dahoko-workspace-sync"
const val SYNC_BUNDLE_VERSION = 1
private const val MAX_WORKSPACES = 100

class SyncDocumentException(message: String) : Exception(message)

@Serializable
data class SyncStamp(val millis: Long, val counter: Long, val deviceId: String)

@Serializable
data class SyncClock(val millis: Long, val counter: Long)

@Serializable
data class SyncEntry<T>(val value: T?, val stamp: SyncStamp)

@Serializable
data class SyncRecords(
    val tasks: Map<String, SyncEntry<Task>> = emptyMap(),
    val lists: Map<String, SyncEntry<TaskList>> = emptyMap(),
    val statuses: Map<String, SyncEntry<Status>> = emptyMap(),
    val subtasks: Map<String, SyncEntry<Subtask>> = emptyMap(),
    val completions: Map<String, SyncEntry<Completion>> = emptyMap(),
)

@Serializable
data class SyncDocument(
    val format: String = SYNC_FORMAT,
    val version: Int = SYNC_VERSION,
    val records: SyncRecords = SyncRecords(),
)

@Serializable
data class SyncWorkspaceDocument(
    val workspace: Workspace,
    val document: SyncDocument,
)

@Serializable
data class SyncBundleDocument(
    val format: String = SYNC_BUNDLE_FORMAT,
    val version: Int = SYNC_BUNDLE_VERSION,
    val workspaces: Map<String, SyncWorkspaceDocument> = emptyMap(),
)

data class LocalSyncState(val document: SyncBundleDocument, val clock: SyncClock)

fun emptySyncBundleDocument() = SyncBundleDocument()

fun compareStamps(left: SyncStamp, right: SyncStamp): Int {
    if (left.millis != right.millis) return left.millis.compareTo(right.millis)
    if (left.counter != right.counter) return left.counter.compareTo(right.counter)
    return left.deviceId.compareTo(right.deviceId)
}

private fun observeStamp(clock: SyncClock, stamp: SyncStamp): SyncClock = when {
    stamp.millis > clock.millis -> SyncClock(stamp.millis, stamp.counter)
    stamp.millis == clock.millis && stamp.counter > clock.counter ->
        SyncClock(clock.millis, stamp.counter)
    else -> clock
}

fun observeDocumentClock(clock: SyncClock, document: SyncDocument): SyncClock {
    var next = clock
    document.records.let { records ->
        listOf(
            records.tasks.values.map { it.stamp },
            records.lists.values.map { it.stamp },
            records.statuses.values.map { it.stamp },
            records.subtasks.values.map { it.stamp },
            records.completions.values.map { it.stamp },
        ).flatten().forEach { next = observeStamp(next, it) }
    }
    return next
}

fun observeBundleClock(clock: SyncClock, bundle: SyncBundleDocument): SyncClock {
    var next = clock
    bundle.workspaces.values.forEach { next = observeDocumentClock(next, it.document) }
    return next
}

/** Mutable HLC used while stamping a batch of edits. */
class StampSource(initial: SyncClock, private val deviceId: String, private val now: Long) {
    var clock: SyncClock = initial
        private set

    fun observe(document: SyncDocument) {
        clock = observeDocumentClock(clock, document)
    }

    fun next(): SyncStamp {
        val millis = maxOf(now, clock.millis)
        val counter = if (millis == clock.millis) clock.counter + 1 else 0L
        clock = SyncClock(millis, counter)
        return SyncStamp(millis, counter, deviceId)
    }
}

private fun <T> reconcileCollection(
    items: List<T>,
    idOf: (T) -> String,
    previous: Map<String, SyncEntry<T>>,
    stamps: StampSource,
): Map<String, SyncEntry<T>> {
    val current = items.associateBy(idOf)
    val ids = (previous.keys + current.keys).sorted()
    val result = LinkedHashMap<String, SyncEntry<T>>()
    for (id in ids) {
        val item = current[id]
        val oldEntry = previous[id]
        if (item != null) {
            result[id] = if (oldEntry?.value != null && oldEntry.value == item) {
                oldEntry
            } else {
                SyncEntry(item, stamps.next())
            }
        } else if (oldEntry != null) {
            result[id] = if (oldEntry.value == null) oldEntry else SyncEntry(null, stamps.next())
        }
    }
    return result
}

fun buildLocalDocument(
    snapshot: RepoSnapshot,
    previous: SyncDocument?,
    stamps: StampSource,
): SyncDocument {
    val prior = previous ?: SyncDocument()
    stamps.observe(prior)
    return SyncDocument(
        records = SyncRecords(
            tasks = reconcileCollection(snapshot.tasks, { it.id }, prior.records.tasks, stamps),
            lists = reconcileCollection(snapshot.lists, { it.id }, prior.records.lists, stamps),
            statuses = reconcileCollection(snapshot.statuses, { it.id }, prior.records.statuses, stamps),
            subtasks = reconcileCollection(snapshot.subtasks, { it.id }, prior.records.subtasks, stamps),
            completions = reconcileCollection(snapshot.completions, { it.id }, prior.records.completions, stamps),
        ),
    )
}

private fun <T> mergeCollection(
    left: Map<String, SyncEntry<T>>,
    right: Map<String, SyncEntry<T>>,
): Map<String, SyncEntry<T>> {
    val ids = (left.keys + right.keys).sorted()
    val merged = LinkedHashMap<String, SyncEntry<T>>()
    for (id in ids) {
        val leftEntry = left[id]
        val rightEntry = right[id]
        merged[id] = when {
            leftEntry == null -> rightEntry!!
            rightEntry == null -> leftEntry
            compareStamps(leftEntry.stamp, rightEntry.stamp) >= 0 -> leftEntry
            else -> rightEntry
        }
    }
    return merged
}

fun mergeSyncDocuments(left: SyncDocument, right: SyncDocument): SyncDocument =
    SyncDocument(
        records = SyncRecords(
            tasks = mergeCollection(left.records.tasks, right.records.tasks),
            lists = mergeCollection(left.records.lists, right.records.lists),
            statuses = mergeCollection(left.records.statuses, right.records.statuses),
            subtasks = mergeCollection(left.records.subtasks, right.records.subtasks),
            completions = mergeCollection(left.records.completions, right.records.completions),
        ),
    )

/**
 * Repairs cross-record relationships after a merge, exactly like the desktop
 * `normalizeMergedDocument`: orphaned list/status references are re-pointed,
 * orphaned subtasks/completions become tombstones, duplicate completions for
 * one (task, dueDate) keep the newer stamp.
 */
fun normalizeMergedDocument(input: SyncDocument, stamps: StampSource): SyncDocument {
    stamps.observe(input)

    val liveStatuses = input.records.statuses.values
        .mapNotNull { it.value }
        .sortedBy { it.sortOrder }
    val firstOpenStatus = liveStatuses.firstOrNull { !it.isDone }
        ?: throw SyncDocumentException("Synced data does not contain an open task status.")
    val statusIds = liveStatuses.map { it.id }.toSet()
    val listIds = input.records.lists.values.mapNotNull { it.value?.id }.toSet()

    val tasks = LinkedHashMap(input.records.tasks)
    for ((id, entry) in input.records.tasks) {
        var task = entry.value ?: continue
        if (task.listId != null && task.listId !in listIds) {
            task = task.copy(listId = null)
        }
        if (task.statusId !in statusIds) {
            task = task.copy(statusId = firstOpenStatus.id)
        }
        if (task != entry.value) {
            tasks[id] = SyncEntry(task, stamps.next())
        }
    }

    val taskIds = tasks.values.mapNotNull { it.value?.id }.toSet()
    val subtasks = LinkedHashMap(input.records.subtasks)
    for ((id, entry) in input.records.subtasks) {
        if (entry.value != null && entry.value.taskId !in taskIds) {
            subtasks[id] = SyncEntry(null, stamps.next())
        }
    }
    val completions = LinkedHashMap(input.records.completions)
    for ((id, entry) in input.records.completions) {
        if (entry.value != null && entry.value.taskId !in taskIds) {
            completions[id] = SyncEntry(null, stamps.next())
        }
    }

    val completionByDate = HashMap<String, String>()
    for ((id, entry) in completions.entries.toList()) {
        val value = entry.value ?: continue
        val key = "${value.taskId}\u0000${value.dueDate}"
        val existingId = completionByDate[key]
        if (existingId == null) {
            completionByDate[key] = id
            continue
        }
        val existing = completions.getValue(existingId)
        val loser = if (compareStamps(existing.stamp, entry.stamp) >= 0) id else existingId
        val winner = if (loser == id) existingId else id
        completions[loser] = SyncEntry(null, stamps.next())
        completionByDate[key] = winner
    }

    return SyncDocument(
        records = SyncRecords(tasks, input.records.lists, input.records.statuses, subtasks, completions),
    )
}

fun documentToSnapshot(document: SyncDocument): RepoSnapshot = RepoSnapshot(
    tasks = document.records.tasks.values.mapNotNull { it.value }.sortedBy { it.sortOrder },
    lists = document.records.lists.values.mapNotNull { it.value }.sortedBy { it.sortOrder },
    statuses = document.records.statuses.values.mapNotNull { it.value }.sortedBy { it.sortOrder },
    subtasks = document.records.subtasks.values.mapNotNull { it.value }.sortedBy { it.sortOrder },
    completions = document.records.completions.values.mapNotNull { it.value }
        .sortedBy { it.dueDate },
)

// --- Bundle (multi-workspace) level -------------------------------------

fun buildLocalSyncBundle(
    snapshots: List<WorkspaceSnapshot>,
    previous: SyncBundleDocument?,
    initialClock: SyncClock,
    deviceId: String,
    now: Long = System.currentTimeMillis(),
): LocalSyncState {
    if (snapshots.isEmpty() || snapshots.size > MAX_WORKSPACES) {
        throw SyncDocumentException("Local data has an invalid number of workspaces.")
    }
    val prior = previous ?: emptySyncBundleDocument()
    val stamps = StampSource(initialClock, deviceId, now)
    val workspaces = LinkedHashMap<String, SyncWorkspaceDocument>()
    for (current in snapshots.sortedBy { it.workspace.id }) {
        if (workspaces.containsKey(current.workspace.id)) {
            throw SyncDocumentException("Local data contains a duplicate workspace.")
        }
        val priorEntry = prior.workspaces[current.workspace.id]
        val document = buildLocalDocument(current.data, priorEntry?.document, stamps)
        workspaces[current.workspace.id] = SyncWorkspaceDocument(current.workspace, document)
    }
    return LocalSyncState(SyncBundleDocument(workspaces = workspaces), stamps.clock)
}

private fun compareWorkspace(left: Workspace, right: Workspace): Int {
    val created = left.createdAt.compareTo(right.createdAt)
    if (created != 0) return created
    return left.toString().compareTo(right.toString())
}

fun mergeSyncBundles(left: SyncBundleDocument, right: SyncBundleDocument): SyncBundleDocument {
    val ids = (left.workspaces.keys + right.workspaces.keys).sorted()
    val workspaces = LinkedHashMap<String, SyncWorkspaceDocument>()
    for (id in ids) {
        val leftEntry = left.workspaces[id]
        val rightEntry = right.workspaces[id]
        workspaces[id] = when {
            leftEntry == null -> rightEntry!!
            rightEntry == null -> leftEntry
            else -> SyncWorkspaceDocument(
                workspace = if (compareWorkspace(leftEntry.workspace, rightEntry.workspace) <= 0) {
                    leftEntry.workspace
                } else {
                    rightEntry.workspace
                },
                document = mergeSyncDocuments(leftEntry.document, rightEntry.document),
            )
        }
    }
    return SyncBundleDocument(workspaces = workspaces)
}

fun normalizeSyncBundle(
    input: SyncBundleDocument,
    initialClock: SyncClock,
    deviceId: String,
    now: Long = System.currentTimeMillis(),
): LocalSyncState {
    val stamps = StampSource(observeBundleClock(initialClock, input), deviceId, now)
    val workspaces = LinkedHashMap<String, SyncWorkspaceDocument>()
    for (id in input.workspaces.keys.sorted()) {
        val entry = input.workspaces.getValue(id)
        workspaces[id] = SyncWorkspaceDocument(
            entry.workspace,
            normalizeMergedDocument(entry.document, stamps),
        )
    }
    return LocalSyncState(SyncBundleDocument(workspaces = workspaces), stamps.clock)
}

fun syncBundleToSnapshots(bundle: SyncBundleDocument): List<WorkspaceSnapshot> =
    bundle.workspaces.values
        .sortedWith(compareBy({ it.workspace.sortOrder }, { it.workspace.id }))
        .map { WorkspaceSnapshot(it.workspace, documentToSnapshot(it.document)) }
