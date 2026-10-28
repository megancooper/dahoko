package com.dahoko.android.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Schedule
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
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.ListEntity
import com.dahoko.android.data.StatusEntity
import com.dahoko.android.data.TaskEntity
import com.dahoko.android.domain.Recurrence
import com.dahoko.android.ui.AppViewModel
import com.dahoko.android.ui.HomeView
import com.dahoko.android.ui.theme.priorityColor
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

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
    var editingListId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(syncState.message) {
        syncState.message?.let { if (syncState.error) snackbar.showSnackbar(it) }
    }

    val viewTitle = when (val v = view) {
        HomeView.Today -> "Today"
        HomeView.Upcoming -> "Upcoming"
        HomeView.All -> "All tasks"
        is HomeView.InList -> lists.firstOrNull { it.id == v.listId }?.name ?: "List"
    }

    Box(Modifier.fillMaxSize()) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet {
                    // Scrollable so a long list of lists is reachable on short screens.
                    Column(
                        Modifier
                            .verticalScroll(rememberScrollState())
                            .padding(vertical = 12.dp),
                    ) {
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
                                    .background(parseHexColor(workspace?.color ?: "#A3D0FF"), CircleShape),
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
                                                .background(parseHexColor(other.color), CircleShape),
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
                                            .background(parseHexColor(list.color), CircleShape),
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
            val openCount = tasks.count { it.completedAt == null }
            val subtitle = when (val v = view) {
                HomeView.Today -> LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))
                HomeView.Upcoming -> "Scheduled ahead"
                HomeView.All -> "$openCount open"
                is HomeView.InList -> "${tasks.count { it.completedAt == null && it.listId == v.listId }} open"
            }
            Scaffold(
                containerColor = pageBackground(),
                snackbarHost = { SnackbarHost(snackbar) },
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = pageBackground()),
                        title = {
                            Column {
                                Text(viewTitle, style = MaterialTheme.typography.titleLarge)
                                Text(
                                    subtitle,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Filled.Menu, "Menu")
                            }
                        },
                        actions = {
                            (view as? HomeView.InList)?.let { current ->
                                IconButton(onClick = { editingListId = current.listId }) {
                                    Icon(Icons.Outlined.Edit, "Edit list")
                                }
                            }
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
                    onDelete = { task ->
                        scope.launch {
                            val snapshot = viewModel.deleteTaskForUndo(task)
                            val result = snackbar.showSnackbar(
                                message = "Task deleted",
                                actionLabel = "Undo",
                                duration = SnackbarDuration.Short,
                            )
                            if (result == SnackbarResult.ActionPerformed) {
                                viewModel.restoreTask(snapshot)
                            }
                        }
                    },
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

        // Nested task detail page: slides in over the list from the right and
        // slides back out on back / close. Keyed by task id so edits to the open
        // task recompose in place instead of re-running the transition.
        val editingTask = editingTaskId?.let { id -> tasks.firstOrNull { it.id == id } }
        LaunchedEffect(editingTaskId, editingTask) {
            if (editingTaskId != null && editingTask == null) editingTaskId = null
        }
        AnimatedContent(
            targetState = editingTask,
            contentKey = { it?.id },
            transitionSpec = {
                if (targetState != null) {
                    (slideInHorizontally(tween(260)) { it } + fadeIn(tween(200))) togetherWith
                        fadeOut(tween(120))
                } else {
                    fadeIn(tween(120)) togetherWith
                        (slideOutHorizontally(tween(220)) { it } + fadeOut(tween(200)))
                }
            },
            label = "taskDetail",
        ) { task ->
            if (task != null) {
                TaskDetailScreen(
                    viewModel = viewModel,
                    task = task,
                    taskTags = tags[task.id] ?: emptyList(),
                    lists = lists,
                    statuses = statuses,
                    subtasks = subtasks.filter { it.taskId == task.id },
                    onBack = { editingTaskId = null },
                )
            } else {
                Box(Modifier.fillMaxSize())
            }
        }
    }

    if (showNewList) {
        ListDialog(
            onSave = { name, color ->
                viewModel.createList(name, color)
                showNewList = false
            },
            onDismiss = { showNewList = false },
        )
    }

    editingListId?.let { id ->
        val list = lists.firstOrNull { it.id == id }
        if (list == null) {
            editingListId = null
        } else {
            ListDialog(
                existing = list,
                taskCount = tasks.count { it.listId == list.id },
                onSave = { name, color ->
                    viewModel.updateList(list, name, color)
                    editingListId = null
                },
                onDelete = {
                    viewModel.deleteList(list)
                    editingListId = null
                },
                onDismiss = { editingListId = null },
            )
        }
    }
}

/** How a row shows its due date, given what the section header already says. */
private enum class DateMode { Full, TimeOnly }

@Composable
private fun TaskListContent(
    modifier: Modifier,
    view: HomeView,
    tasks: List<TaskEntity>,
    statusesById: Map<String, StatusEntity>,
    doneStatusIds: Set<String>,
    listsById: Map<String, ListEntity>,
    tags: Map<String, List<String>>,
    subtaskCounts: Map<String, Pair<Int, Int>>,
    onToggle: (TaskEntity) -> Unit,
    onOpen: (TaskEntity) -> Unit,
    onDelete: (TaskEntity) -> Unit,
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
                .map { (day, dayTasks) -> friendlyDay(day, today, long = true) to dayTasks }
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

    val dateMode = when (view) {
        HomeView.Today, HomeView.Upcoming -> DateMode.TimeOnly
        HomeView.All, is HomeView.InList -> DateMode.Full
    }
    val showList = view !is HomeView.InList
    val cardColor = groupCardColor()
    var showCompleted by rememberSaveable { mutableStateOf(false) }

    LazyColumn(
        modifier,
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 112.dp),
    ) {
        val isEmpty = sections.all { it.second.isEmpty() } && completedVisible.isEmpty()
        if (isEmpty) {
            item(key = "empty") { EmptyState(view) }
        }
        sections.forEach { (title, sectionTasks) ->
            if (sectionTasks.isNotEmpty()) {
                val overdue = title == "Overdue"
                item(key = "header-$title") {
                    SectionHeader(
                        title = title,
                        count = sectionTasks.size,
                        highlight = overdue,
                        modifier = Modifier.animateItem(),
                    )
                }
                itemsIndexed(sectionTasks, key = { _, task -> task.id }) { index, task ->
                    GroupedRow(
                        first = index == 0,
                        last = index == sectionTasks.lastIndex,
                        color = cardColor,
                        modifier = Modifier.animateItem(),
                    ) {
                        SwipeToDeleteRow(cardColor = cardColor, onDelete = { onDelete(task) }) {
                            TaskRow(
                                task = task,
                                today = today,
                                overdue = overdue,
                                dateMode = if (overdue) DateMode.Full else dateMode,
                                list = task.listId?.let { listsById[it] },
                                showList = showList,
                                taskTags = tags[task.id] ?: emptyList(),
                                subtaskCount = subtaskCounts[task.id],
                                onToggle = { onToggle(task) },
                                onOpen = { onOpen(task) },
                            )
                        }
                    }
                }
            }
        }
        if (completedVisible.isNotEmpty()) {
            item(key = "completed-header") {
                val rotation by animateFloatAsState(
                    if (showCompleted) 180f else 0f,
                    label = "completedChevron",
                )
                Row(
                    Modifier
                        .animateItem()
                        .fillMaxWidth()
                        .clip(MaterialTheme.shapes.small)
                        .clickable { showCompleted = !showCompleted }
                        .padding(start = 4.dp, end = 4.dp, top = 22.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "COMPLETED",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.size(6.dp))
                    Text(
                        "${completedVisible.size}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                    Spacer(Modifier.weight(1f))
                    Icon(
                        Icons.Filled.ExpandMore,
                        if (showCompleted) "Hide completed" else "Show completed",
                        Modifier
                            .size(18.dp)
                            .rotate(rotation),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (showCompleted) {
                itemsIndexed(completedVisible, key = { _, task -> "done-${task.id}" }) { index, task ->
                    GroupedRow(
                        first = index == 0,
                        last = index == completedVisible.lastIndex,
                        color = cardColor,
                        modifier = Modifier.animateItem(),
                    ) {
                        SwipeToDeleteRow(cardColor = cardColor, onDelete = { onDelete(task) }) {
                            TaskRow(
                                task = task,
                                today = today,
                                overdue = false,
                                dateMode = DateMode.Full,
                                list = task.listId?.let { listsById[it] },
                                showList = showList,
                                taskTags = tags[task.id] ?: emptyList(),
                                subtaskCount = subtaskCounts[task.id],
                                onToggle = { onToggle(task) },
                                onOpen = { onOpen(task) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Swipe a row right-to-left to delete it. The caller shows the Undo
 * snackbar; the row is removed as soon as the store emits without it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeToDeleteRow(
    cardColor: Color,
    onDelete: () -> Unit,
    content: @Composable () -> Unit,
) {
    val currentOnDelete by rememberUpdatedState(onDelete)
    val state = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                currentOnDelete()
                true
            } else {
                false
            }
        },
        positionalThreshold = { distance -> distance * 0.4f },
    )
    SwipeToDismissBox(
        state = state,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            val armed = state.targetValue == SwipeToDismissBoxValue.EndToStart
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        if (armed) MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.errorContainer,
                    )
                    .padding(end = 22.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Icon(
                    Icons.Outlined.Delete,
                    "Delete task",
                    Modifier.size(22.dp),
                    tint = if (armed) MaterialTheme.colorScheme.onError
                    else MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        },
    ) {
        Box(Modifier.background(cardColor)) { content() }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    count: Int,
    highlight: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(start = 4.dp, top = 18.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = if (highlight) {
                MaterialTheme.colorScheme.error
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
        )
        Spacer(Modifier.size(6.dp))
        Text(
            "$count",
            style = MaterialTheme.typography.labelSmall,
            color = if (highlight) {
                MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
            } else {
                MaterialTheme.colorScheme.outline
            },
        )
    }
}

/**
 * One row of a grouped card: rounded on the outer corners of the first and
 * last rows, hairline-divided in between, so a section reads as one surface.
 */
@Composable
private fun GroupedRow(
    first: Boolean,
    last: Boolean,
    color: Color,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val r = GroupCardRadius
    val shape = RoundedCornerShape(
        topStart = if (first) r else 0.dp,
        topEnd = if (first) r else 0.dp,
        bottomStart = if (last) r else 0.dp,
        bottomEnd = if (last) r else 0.dp,
    )
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(color),
    ) {
        content()
        if (!last) {
            HorizontalDivider(
                Modifier.padding(start = 54.dp),
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f),
            )
        }
    }
}

@Composable
private fun EmptyState(view: HomeView) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 120.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(64.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Check,
                null,
                Modifier.size(30.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        Spacer(Modifier.height(16.dp))
        Text("All clear", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            when (view) {
                HomeView.Today -> "Nothing due today."
                HomeView.Upcoming -> "Nothing scheduled ahead."
                else -> "Tap + to add a task."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TaskRow(
    task: TaskEntity,
    today: LocalDate,
    overdue: Boolean,
    dateMode: DateMode,
    list: ListEntity?,
    showList: Boolean,
    taskTags: List<String>,
    subtaskCount: Pair<Int, Int>?,
    onToggle: () -> Unit,
    onOpen: () -> Unit,
) {
    val done = task.completedAt != null
    val accent = priorityColor(task.priority) ?: MaterialTheme.colorScheme.outline
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .padding(start = 6.dp, end = 16.dp, top = 4.dp, bottom = 4.dp)
            .alpha(if (done) 0.6f else 1f),
        verticalAlignment = Alignment.Top,
    ) {
        CheckCircle(
            done = done,
            accent = accent,
            onClick = onToggle,
            modifier = Modifier.padding(top = 3.dp),
        )
        Column(
            Modifier
                .weight(1f)
                .padding(start = 2.dp, top = 10.dp, bottom = 10.dp),
        ) {
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
            if (task.notes.isNotBlank()) {
                Text(
                    task.notes.trim().replace('\n', ' '),
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            val dueDate = dueDateOf(task)
            val dueTime = dueTimeOf(task)
            val dueLabel: String? = when (dateMode) {
                DateMode.Full -> listOfNotNull(
                    dueDate?.let { friendlyDay(it, today) },
                    dueTime?.let { friendlyTime(it) },
                ).joinToString(" · ").ifBlank { null }
                DateMode.TimeOnly -> dueTime?.let { friendlyTime(it) }
            }
            val recurrence = Recurrence.fromWire(task.recurrence)
            val recurring = recurrence != null
            val showListPill = showList && list != null
            val hasMeta = dueLabel != null || recurring || subtaskCount != null ||
                taskTags.isNotEmpty() || showListPill
            if (hasMeta) {
                FlowRow(
                    Modifier.padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (dueLabel != null || recurring) {
                        MetaPill(
                            text = dueLabel ?: recurrence!!.label,
                            icon = when {
                                recurring -> Icons.Outlined.Repeat
                                dueDate != null && dateMode == DateMode.Full -> Icons.Outlined.CalendarToday
                                else -> Icons.Outlined.Schedule
                            },
                            tone = when {
                                done -> PillTone.Neutral
                                overdue -> PillTone.Error
                                dueDate == today -> PillTone.Accent
                                else -> PillTone.Neutral
                            },
                        )
                    }
                    subtaskCount?.let { (doneCount, total) ->
                        MetaPill("$doneCount/$total", icon = Icons.Outlined.Checklist)
                    }
                    taskTags.forEach { MetaPill("#$it") }
                    if (showListPill) {
                        MetaPill(list!!.name, dot = parseHexColor(list.color), tone = PillTone.Plain)
                    }
                }
            }
        }
    }
}
