package com.dahoko.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dahoko.android.AppLog
import com.dahoko.android.DahokoApp
import com.dahoko.android.data.ListEntity
import com.dahoko.android.data.StatusEntity
import com.dahoko.android.data.SubtaskEntity
import com.dahoko.android.data.TaskEntity
import com.dahoko.android.data.TaskTagEntity
import com.dahoko.android.data.WorkspaceEntity
import com.dahoko.android.data.nowIso
import com.dahoko.android.domain.QuickAddResult
import com.dahoko.android.domain.parseQuickAdd
import com.dahoko.android.sync.BillingState
import com.dahoko.android.sync.SavedSyncConfig
import com.dahoko.android.sync.SyncApi
import com.dahoko.android.sync.SyncApiException
import com.dahoko.android.sync.SyncCredentials
import com.dahoko.android.sync.SyncCryptoException
import com.dahoko.android.sync.SyncDocumentException
import com.dahoko.android.sync.deriveSyncKey
import com.dahoko.android.sync.normalizeSyncServerUrl
import com.dahoko.android.sync.runEncryptedSync
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface HomeView {
    data object Today : HomeView
    data object Upcoming : HomeView
    data object All : HomeView
    data class InList(val listId: String) : HomeView
}

data class SyncUiState(
    val config: SavedSyncConfig? = null,
    val connected: Boolean = false,
    val syncing: Boolean = false,
    val message: String? = null,
    val error: Boolean = false,
    /** Plan state; null when the server has billing disabled or is unknown. */
    val billing: BillingState? = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as DahokoApp
    private val repo = app.repository
    private val store = app.syncStore
    private val api = SyncApi()

    val workspaces: StateFlow<List<WorkspaceEntity>> = repo.dao.observeWorkspaces()
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _workspaceId = MutableStateFlow(com.dahoko.android.data.DEFAULT_WORKSPACE_ID)
    val workspaceId: StateFlow<String> = _workspaceId

    private val _view = MutableStateFlow<HomeView>(HomeView.Today)
    val view: StateFlow<HomeView> = _view

    val lists: StateFlow<List<ListEntity>> = _workspaceId
        .flatMapLatest { repo.dao.observeLists(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val statuses: StateFlow<List<StatusEntity>> = _workspaceId
        .flatMapLatest { repo.dao.observeStatuses(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val tasks: StateFlow<List<TaskEntity>> = _workspaceId
        .flatMapLatest { repo.dao.observeTasks(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val tags: StateFlow<Map<String, List<String>>> = _workspaceId
        .flatMapLatest { repo.dao.observeTags(it) }
        .combine(MutableStateFlow(Unit)) { rows, _ -> rows.groupBy({ it.taskId }, { it.tag }) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyMap())

    val subtasks: StateFlow<List<SubtaskEntity>> = _workspaceId
        .flatMapLatest { repo.dao.observeSubtasks(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _syncState = MutableStateFlow(SyncUiState())
    val syncState: StateFlow<SyncUiState> = _syncState

    // Secrets stay in memory only, mirroring the desktop app's session model.
    private var credentials: SyncCredentials? = null

    init {
        viewModelScope.launch {
            repo.ensureSeeded()
            val saved = store.loadConfig()
            if (saved != null) {
                _syncState.value = SyncUiState(config = saved)
            }
        }
    }

    fun selectWorkspace(id: String) {
        _workspaceId.value = id
        _view.value = HomeView.Today
    }

    fun selectView(view: HomeView) {
        _view.value = view
    }

    fun previewQuickAdd(input: String): QuickAddResult = parseQuickAdd(input)

    fun quickAdd(input: String) {
        val parsed = parseQuickAdd(input)
        if (parsed.title.isBlank()) return
        viewModelScope.launch {
            val statusList = statuses.value
            val openStatus = statusList.firstOrNull { !it.isDone } ?: return@launch
            val currentView = _view.value
            val dueAt = when {
                parsed.dueDate != null && parsed.dueTime != null ->
                    "${parsed.dueDate}T${parsed.dueTime}:00"
                parsed.dueDate != null -> parsed.dueDate
                currentView is HomeView.Today -> LocalDate.now().toString()
                else -> null
            }
            repo.createTask(
                workspaceId = _workspaceId.value,
                title = parsed.title,
                dueAt = dueAt,
                hasDueTime = parsed.dueTime != null,
                priority = parsed.priority,
                listId = (currentView as? HomeView.InList)?.listId,
                statusId = openStatus.id,
                tags = parsed.tags,
                recurrence = parsed.recurrence,
                sortOrder = (tasks.value.maxOfOrNull { it.sortOrder } ?: 0) + 1,
            )
        }
    }

    fun toggleComplete(task: TaskEntity) {
        viewModelScope.launch {
            if (task.completedAt == null) {
                repo.completeTask(task, statuses.value.firstOrNull { it.isDone }?.id)
            } else {
                repo.uncompleteTask(task, statuses.value.firstOrNull { !it.isDone }?.id)
            }
        }
    }

    fun updateTask(task: TaskEntity, taskTags: List<String>) {
        viewModelScope.launch { repo.updateTask(task, taskTags) }
    }

    fun deleteTask(taskId: String) {
        viewModelScope.launch { repo.deleteTask(taskId) }
    }

    fun addSubtask(taskId: String, title: String) {
        viewModelScope.launch {
            val order = (subtasks.value.filter { it.taskId == taskId }
                .maxOfOrNull { it.sortOrder } ?: 0) + 1
            repo.dao.upsertSubtask(
                SubtaskEntity(
                    id = UUID.randomUUID().toString(),
                    workspaceId = _workspaceId.value,
                    taskId = taskId,
                    title = title,
                    done = false,
                    sortOrder = order,
                ),
            )
        }
    }

    fun toggleSubtask(subtask: SubtaskEntity) {
        viewModelScope.launch { repo.dao.upsertSubtask(subtask.copy(done = !subtask.done)) }
    }

    fun deleteSubtask(subtaskId: String) {
        viewModelScope.launch { repo.dao.deleteSubtask(subtaskId) }
    }

    fun createList(name: String, color: String) {
        viewModelScope.launch {
            val order = (lists.value.maxOfOrNull { it.sortOrder } ?: 0) + 1
            repo.createList(_workspaceId.value, name, color, order)
        }
    }

    // --- Encrypted sync ---------------------------------------------------

    fun connectSync(
        serverUrl: String,
        mode: String,
        email: String,
        password: String,
        passphrase: String,
    ) {
        viewModelScope.launch {
            _syncState.value = _syncState.value.copy(syncing = true, message = "Connecting…", error = false)
            try {
                val result = withContext(Dispatchers.IO) {
                    val normalized = normalizeSyncServerUrl(serverUrl)
                    val auth = api.authenticate(normalized, mode, email.trim(), password)
                    val key = deriveSyncKey(passphrase, auth.encryptionSalt)
                    SyncCredentials(normalized, auth.token, auth.encryptionSalt, key, store.deviceId)
                }
                credentials = result
                val config = SavedSyncConfig(result.serverUrl, email.trim(), null)
                store.saveConfig(config)
                val billing = withContext(Dispatchers.IO) {
                    // Plan details are cosmetic here; sync reports its own errors.
                    try {
                        api.getBilling(result.serverUrl, result.token)
                    } catch (error: Exception) {
                        null
                    }
                }
                _syncState.value = SyncUiState(
                    config = config,
                    connected = true,
                    message = "Connected. Running first sync…",
                    billing = billing,
                )
                syncNow()
            } catch (error: Exception) {
                // 4xx responses are expected states (bad password, lapsed
                // plan); anything else is a bug or outage worth a report.
                if (error is SyncApiException && error.status in 400..499) {
                    AppLog.w("sync", "connect rejected", mapOf("status" to error.status, "mode" to mode))
                } else {
                    AppLog.e("sync", "connect failed", error, mapOf("mode" to mode))
                }
                _syncState.value = _syncState.value.copy(
                    syncing = false,
                    message = syncErrorMessage(error),
                    error = true,
                )
            }
        }
    }

    fun syncNow() {
        val creds = credentials ?: run {
            _syncState.value = _syncState.value.copy(
                message = "Sign in with your passphrase to sync.",
                error = true,
            )
            return
        }
        viewModelScope.launch {
            _syncState.value = _syncState.value.copy(syncing = true, message = "Syncing…", error = false)
            try {
                val accountKey = store.accountKey(creds.serverUrl, _syncState.value.config?.email ?: "")
                val result = withContext(Dispatchers.IO) {
                    val snapshots = repo.buildBundleSnapshot()
                    val previous = store.loadState(accountKey)
                    runEncryptedSync(api, creds, snapshots, previous)
                }
                withContext(Dispatchers.IO) {
                    repo.applyBundleSnapshot(result.snapshots)
                    store.saveState(accountKey, result.localState)
                }
                val syncedAt = nowIso()
                _syncState.value.config?.let {
                    store.saveConfig(it.copy(lastSyncedAt = syncedAt))
                }
                _syncState.value = _syncState.value.copy(
                    config = _syncState.value.config?.copy(lastSyncedAt = syncedAt),
                    connected = true,
                    syncing = false,
                    message = if (result.uploaded) "Synced and uploaded." else "Already up to date.",
                    error = false,
                )
                if (workspaces.value.none { it.id == _workspaceId.value }) {
                    workspaces.value.firstOrNull()?.let { _workspaceId.value = it.id }
                }
            } catch (error: Exception) {
                if (error is SyncApiException && error.status in 400..499) {
                    AppLog.w("sync", "sync rejected", mapOf("status" to error.status))
                } else {
                    AppLog.e("sync", "sync failed", error)
                }
                _syncState.value = _syncState.value.copy(
                    syncing = false,
                    message = syncErrorMessage(error),
                    error = true,
                )
            }
        }
    }

    fun disconnectSync() {
        val creds = credentials
        credentials = null
        store.clearConfig()
        _syncState.value = SyncUiState()
        if (creds != null) {
            viewModelScope.launch(Dispatchers.IO) { api.logout(creds.serverUrl, creds.token) }
        }
    }

    // --- Dahoko Cloud billing --------------------------------------------

    /** Fetches a checkout URL and hands it to the UI to open in a browser. */
    fun startCheckout(interval: String, onUrl: (String) -> Unit) {
        val creds = credentials ?: return
        viewModelScope.launch {
            try {
                val url = withContext(Dispatchers.IO) {
                    api.createCheckout(
                        creds.serverUrl,
                        creds.token,
                        _syncState.value.config?.email ?: "",
                        interval,
                    )
                }
                onUrl(url)
            } catch (error: Exception) {
                AppLog.e("billing", "checkout failed", error, mapOf("interval" to interval))
                _syncState.value = _syncState.value.copy(
                    message = syncErrorMessage(error),
                    error = true,
                )
            }
        }
    }

    fun openBillingPortal(onUrl: (String) -> Unit) {
        val creds = credentials ?: return
        viewModelScope.launch {
            try {
                val url = withContext(Dispatchers.IO) {
                    api.createPortal(creds.serverUrl, creds.token)
                }
                onUrl(url)
            } catch (error: Exception) {
                AppLog.e("billing", "portal open failed", error)
                _syncState.value = _syncState.value.copy(
                    message = syncErrorMessage(error),
                    error = true,
                )
            }
        }
    }

    /**
     * Eagerly re-reads plan state from Stripe (used when returning from
     * checkout) and retries sync when the plan just became active.
     */
    fun refreshBilling() {
        val creds = credentials ?: return
        viewModelScope.launch {
            try {
                val subscription = withContext(Dispatchers.IO) {
                    api.refreshBilling(creds.serverUrl, creds.token)
                }
                val current = _syncState.value.billing
                _syncState.value = _syncState.value.copy(
                    billing = BillingState(
                        subscription = subscription,
                        syncRequiresSubscription =
                            current?.syncRequiresSubscription ?: true,
                    ),
                    message = null,
                    error = false,
                )
                if (subscription.active) syncNow()
            } catch (error: Exception) {
                AppLog.e("billing", "billing refresh failed", error)
                _syncState.value = _syncState.value.copy(
                    message = syncErrorMessage(error),
                    error = true,
                )
            }
        }
    }

    private fun syncErrorMessage(error: Exception): String = when (error) {
        is SyncApiException, is SyncCryptoException, is SyncDocumentException ->
            error.message ?: "Sync failed."
        else -> "Sync failed: ${error.message ?: "unknown error"}"
    }
}
