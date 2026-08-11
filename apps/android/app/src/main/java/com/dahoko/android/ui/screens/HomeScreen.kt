package com.dahoko.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.TaskEntity
import com.dahoko.android.domain.Recurrence
import com.dahoko.android.ui.AppViewModel
import com.dahoko.android.ui.HomeView
import com.dahoko.android.ui.theme.priorityColor
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

private fun parseColor(hex: String): Color = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (error: IllegalArgumentException) {
    Color.Gray
}

private fun dueDateOf(task: TaskEntity): LocalDate? =
    task.dueAt?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: AppViewModel, onOpenSettings: () -> Unit) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    val workspaces by viewModel.workspaces.collectAsState()
    val workspaceId by viewModel.workspaceId.collectAsState()
    val view by viewModel.view.collectAsState()
    val lists by viewModel.lists.collectAsState()
    val statuses by viewModel.statuses.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val tags by viewModel.tags.collectAsState()
    val subtasks by viewModel.subtasks.collectAsState()
    val syncState by viewModel.syncState.collectAsState()

    var showQuickAdd by rememberSaveable { mutableStateOf(false) }
    var editingTaskId by rememberSaveable { mutableStateOf<String?>(null) }
    var showNewList by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(syncState.message) {
        syncState.message?.let { if (syncState.error) snackbar.showSnackbar(it) }
    }

    val viewTitle = when (val v = view) {
        HomeView.Today -> "Today"
        HomeView.Upcoming -> "Upcoming"
        HomeView.All -> "All tasks"
        is HomeView.InList -> lists.firstOrNull { it.id == v.listId }?.name ?: "List"
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Column(Modifier.padding(vertical = 12.dp)) {
                    val workspace = workspaces.firstOrNull { it.id == workspaceId }
                    // Brand header: the same pastel-blue check mark that opens
                    // the desktop app and the website.
                    Row(
                        Modifier.padding(horizontal = 28.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(32.dp)
                                .background(
                                    MaterialTheme.colorScheme.primary,
                                    MaterialTheme.shapes.small,
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Check,
                                null,
                                Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.onPrimary,
                            )
                        }
                        Spacer(Modifier.size(12.dp))
                        Text(
                            "dahoko",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    }
                    Row(
                        Modifier.padding(horizontal = 28.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(10.dp)
                                .background(parseColor(workspace?.color ?: "#A3D0FF"), CircleShape),
                        )
                        Spacer(Modifier.size(10.dp))
                        Text(
                            (workspace?.name ?: "Workspace").uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (workspaces.size > 1) {
                        workspaces.filter { it.id != workspaceId }.forEach { other ->
                            NavigationDrawerItem(
                                label = { Text(other.name) },
                                selected = false,
                                onClick = {
                                    viewModel.selectWorkspace(other.id)
                                    scope.launch { drawerState.close() }
                                },
                                icon = {
                                    Box(
                                        Modifier
                                            .size(10.dp)
                                            .background(parseColor(other.color), CircleShape),
                                    )
                                },
                                modifier = Modifier.padding(horizontal = 12.dp),
                            )
                        }
                        HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    }
                    NavigationDrawerItem(
                        label = { Text("Today") },
                        icon = { Icon(Icons.Filled.Today, null) },
                        selected = view == HomeView.Today,
                        onClick = {
                            viewModel.selectView(HomeView.Today)
                            scope.launch { drawerState.close() }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    NavigationDrawerItem(
                        label = { Text("Upcoming") },
                        icon = { Icon(Icons.Filled.CalendarMonth, null) },
                        selected = view == HomeView.Upcoming,
                        onClick = {
                            viewModel.selectView(HomeView.Upcoming)
                            scope.launch { drawerState.close() }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    NavigationDrawerItem(
                        label = { Text("All tasks") },
                        icon = { Icon(Icons.Filled.Inbox, null) },
                        selected = view == HomeView.All,
                        onClick = {
                            viewModel.selectView(HomeView.All)
                            scope.launch { drawerState.close() }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 28.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "LISTS",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        IconButton(onClick = { showNewList = true }) {
                            Icon(Icons.Filled.Add, "New list")
                        }
                    }
                    lists.forEach { list ->
                        NavigationDrawerItem(
                            label = { Text(list.name) },
                            icon = {
                                Box(
                                    Modifier
                                        .size(10.dp)
                                        .background(parseColor(list.color), CircleShape),
                                )
                            },
                            selected = (view as? HomeView.InList)?.listId == list.id,
                            onClick = {
                                viewModel.selectView(HomeView.InList(list.id))
                                scope.launch { drawerState.close() }
                            },
                            modifier = Modifier.padding(horizontal = 12.dp),
                        )
                    }
                    if (lists.isEmpty()) {
                        Text(
                            "No lists yet",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 28.dp, vertical = 4.dp),
                        )
                    }
                    HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    NavigationDrawerItem(
                        label = { Text("Settings") },
                        icon = { Icon(Icons.Filled.Settings, null) },
                        selected = false,
                        onClick = {
                            scope.launch { drawerState.close() }
                            onOpenSettings()
                        },
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                }
            }
        },
    ) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbar) },
            topBar = {
                TopAppBar(
                    title = { Text(viewTitle) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Filled.Menu, "Menu")
                        }
                    },
                    actions = {
                        if (syncState.config != null) {
                            if (syncState.syncing) {
                                CircularProgressIndicator(
                                    Modifier
                                        .padding(horizontal = 14.dp)
                                        .size(22.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                IconButton(onClick = { viewModel.syncNow() }) {
                                    Icon(Icons.Filled.Sync, "Sync now")
                                }
                            }
                        }
                    },
                )
            },
            floatingActionButton = {
                FloatingActionButton(
                    onClick = { showQuickAdd = true },
                    modifier = Modifier.border(
                        1.dp,
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.28f),
                        MaterialTheme.shapes.large,
                    ),
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    shape = MaterialTheme.shapes.large,
                ) {
                    Icon(Icons.Filled.Add, "Add task")
                }
            },
        ) { padding ->
            TaskListContent(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize(),
                view = view,
                tasks = tasks,
                statusesById = statuses.associateBy { it.id },
                doneStatusIds = statuses.filter { it.isDone }.map { it.id }.toSet(),
                listsById = lists.associateBy { it.id },
                tags = tags,
                subtaskCounts = subtasks.groupBy { it.taskId }
                    .mapValues { (_, rows) -> rows.count { it.done } to rows.size },
                onToggle = viewModel::toggleComplete,
                onOpen = { editingTaskId = it.id },
            )
        }
    }

    if (showQuickAdd) {
        QuickAddSheet(
            viewModel = viewModel,
            listsById = lists.associateBy { it.id },
            onDismiss = { showQuickAdd = false },
        )
    }

    editingTaskId?.let { taskId ->
        tasks.firstOrNull { it.id == taskId }?.let { task ->
            TaskDetailSheet(
                viewModel = viewModel,
                task = task,
                taskTags = tags[task.id] ?: emptyList(),
                lists = lists,
                statuses = statuses,
                subtasks = subtasks.filter { it.taskId == task.id },
                onDismiss = { editingTaskId = null },
            )
        } ?: run { editingTaskId = null }
    }

    if (showNewList) {
        NewListDialog(
            onCreate = { name, color ->
                viewModel.createList(name, color)
                showNewList = false
            },
            onDismiss = { showNewList = false },
        )
    }
}

@Composable
private fun TaskListContent(
    modifier: Modifier,
    view: HomeView,
    tasks: List<TaskEntity>,
    statusesById: Map<String, com.dahoko.android.data.StatusEntity>,
    doneStatusIds: Set<String>,
    listsById: Map<String, com.dahoko.android.data.ListEntity>,
    tags: Map<String, List<String>>,
    subtaskCounts: Map<String, Pair<Int, Int>>,
    onToggle: (TaskEntity) -> Unit,
    onOpen: (TaskEntity) -> Unit,
) {
    val today = LocalDate.now()
    val open = tasks.filter { it.completedAt == null }
    val completed = tasks.filter { it.completedAt != null }

    // Section title -> tasks
    val sections: List<Pair<String, List<TaskEntity>>> = when (view) {
        HomeView.Today -> {
            val overdue = open.filter { (dueDateOf(it) ?: today.plusDays(1)) < today }
            val due = open.filter { dueDateOf(it) == today }
            listOfNotNull(
                if (overdue.isNotEmpty()) "Overdue" to overdue else null,
                "Today" to due,
            )
        }
        HomeView.Upcoming -> {
            val upcoming = open
                .filter { (dueDateOf(it) ?: today.minusDays(1)) > today }
                .sortedBy { it.dueAt }
            val byDay = upcoming.groupBy { dueDateOf(it)!! }
            byDay.entries
                .sortedBy { it.key }
                .map { (day, dayTasks) ->
                    val label = when {
                        day == today.plusDays(1) -> "Tomorrow"
                        day < today.plusDays(7) ->
                            day.format(DateTimeFormatter.ofPattern("EEEE"))
                        else -> day.format(DateTimeFormatter.ofPattern("MMM d"))
                    }
                    label to dayTasks
                }
        }
        HomeView.All -> statusesById.values
            .sortedBy { it.sortOrder }
            .map { status -> status.name to open.filter { it.statusId == status.id } }
            .filter { it.second.isNotEmpty() }
            .ifEmpty { listOf("Tasks" to emptyList()) }
        is HomeView.InList -> {
            val inList = open.filter { it.listId == view.listId }
            statusesById.values
                .sortedBy { it.sortOrder }
                .map { status -> status.name to inList.filter { it.statusId == status.id } }
                .filter { it.second.isNotEmpty() }
                .ifEmpty { listOf("Tasks" to emptyList()) }
        }
    }

    val completedVisible = when (view) {
        HomeView.Today -> completed.filter { dueDateOf(it) == today }
        is HomeView.InList -> completed.filter { it.listId == view.listId }
        HomeView.All -> completed
        HomeView.Upcoming -> emptyList()
    }

    var showCompleted by rememberSaveable { mutableStateOf(false) }

    LazyColumn(modifier, contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 96.dp)) {
        val isEmpty = sections.all { it.second.isEmpty() } && completedVisible.isEmpty()
        if (isEmpty) {
            item {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 120.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(
                        Icons.Filled.Check,
                        null,
                        Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.outlineVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "All clear",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Tap + to add a task",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
            }
        }
        sections.forEach { (title, sectionTasks) ->
            if (sectionTasks.isNotEmpty()) {
                item(key = "header-$title") {
                    Text(
                        title.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (title == "Overdue") {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 6.dp),
                    )
                }
                items(sectionTasks, key = { it.id }) { task ->
                    TaskRow(
                        task = task,
                        overdue = title == "Overdue",
                        listName = task.listId?.let { listsById[it] },
                        taskTags = tags[task.id] ?: emptyList(),
                        subtaskCount = subtaskCounts[task.id],
                        statusColor = statusesById[task.statusId]?.color,
                        onToggle = { onToggle(task) },
                        onOpen = { onOpen(task) },
                    )
                }
            }
        }
        if (completedVisible.isNotEmpty()) {
            item(key = "completed-header") {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { showCompleted = !showCompleted }
                        .padding(start = 20.dp, top = 20.dp, bottom = 4.dp, end = 20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "COMPLETED · ${completedVisible.size}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        if (showCompleted) "Hide" else "Show",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            if (showCompleted) {
                items(completedVisible, key = { "done-${it.id}" }) { task ->
                    TaskRow(
                        task = task,
                        overdue = false,
                        listName = task.listId?.let { listsById[it] },
                        taskTags = tags[task.id] ?: emptyList(),
                        subtaskCount = subtaskCounts[task.id],
                        statusColor = statusesById[task.statusId]?.color,
                        onToggle = { onToggle(task) },
                        onOpen = { onOpen(task) },
                    )
                }
            }
        }
    }
}

@Composable
private fun TaskRow(
    task: TaskEntity,
    overdue: Boolean,
    listName: com.dahoko.android.data.ListEntity?,
    taskTags: List<String>,
    subtaskCount: Pair<Int, Int>?,
    statusColor: String?,
    onToggle: () -> Unit,
    onOpen: () -> Unit,
) {
    val done = task.completedAt != null
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(start = 8.dp, end = 20.dp, top = 4.dp, bottom = 4.dp)
            .alpha(if (done) 0.65f else 1f),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val accent = priorityColor(task.priority) ?: MaterialTheme.colorScheme.outline
        // A 44dp touch target around the 22dp visual circle — taps that land
        // near the circle toggle the task instead of opening the sheet.
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable(onClick = onToggle),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .size(22.dp)
                    .background(
                        if (done) MaterialTheme.colorScheme.primary else Color.Transparent,
                        CircleShape,
                    )
                    .then(
                        if (done) Modifier else Modifier.border(1.5.dp, accent, CircleShape),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (done) {
                    Icon(
                        Icons.Filled.Check,
                        "Completed",
                        Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onPrimary,
                    )
                }
            }
        }
        Spacer(Modifier.size(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                task.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (done) TextDecoration.LineThrough else null,
                color = if (done) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
            )
            val meta = buildList {
                task.dueAt?.let {
                    val label = if (task.hasDueTime && it.length > 11) {
                        "${it.take(10)} ${it.substring(11).take(5)}"
                    } else {
                        it.take(10)
                    }
                    add(label)
                }
                listName?.let { add(it.name) }
                subtaskCount?.let { (doneCount, total) -> add("$doneCount/$total") }
                taskTags.forEach { add("#$it") }
            }
            if (meta.isNotEmpty() || Recurrence.fromWire(task.recurrence) != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (Recurrence.fromWire(task.recurrence) != null) {
                        Icon(
                            Icons.Filled.Repeat,
                            "Repeats",
                            Modifier.size(13.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.size(4.dp))
                    }
                    Text(
                        meta.joinToString("  ·  "),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = if (overdue) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
        listName?.let {
            Box(
                Modifier
                    .size(8.dp)
                    .background(parseColor(it.color), CircleShape),
            )
        }
    }
}

