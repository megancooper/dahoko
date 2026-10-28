package com.dahoko.android.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Label
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.ListEntity
import com.dahoko.android.data.StatusEntity
import com.dahoko.android.data.SubtaskEntity
import com.dahoko.android.data.TaskEntity
import com.dahoko.android.domain.Recurrence
import com.dahoko.android.ui.AppViewModel
import com.dahoko.android.ui.theme.priorityColor
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

private enum class PickerSheet { Status, ListPick, Repeat }

private data class SheetOption<T>(val value: T, val label: String, val color: Color? = null)

/**
 * Task detail as a nested, full-screen page. A plain hero (check, title,
 * description) sits on the tinted page; everything structured lives in
 * grouped cards of property rows that open pickers, so the page reads top
 * to bottom like a form instead of a wall of chips. Title / description
 * are written when the page is left; every other change writes at once and
 * carries the in-progress title / description with it.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TaskDetailScreen(
    viewModel: AppViewModel,
    task: TaskEntity,
    taskTags: List<String>,
    lists: List<ListEntity>,
    statuses: List<StatusEntity>,
    subtasks: List<SubtaskEntity>,
    onBack: () -> Unit,
) {
    var title by remember(task.id) { mutableStateOf(task.title) }
    var notes by remember(task.id) { mutableStateOf(task.notes) }
    var tagList by remember(task.id) { mutableStateOf(taskTags) }
    var tagInput by remember(task.id) { mutableStateOf("") }
    var newSubtask by remember(task.id) { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var sheet by remember { mutableStateOf<PickerSheet?>(null) }

    fun tagTokens(text: String): List<String> = text
        .split(Regex("[,\\s]+"))
        .map { it.trim().removePrefix("#").lowercase() }
        .filter { it.isNotBlank() }

    fun allTags(): List<String> = (tagList + tagTokens(tagInput)).distinct()

    fun commitTagInput() {
        val tokens = tagTokens(tagInput)
        if (tokens.isNotEmpty()) tagList = (tagList + tokens).distinct()
        tagInput = ""
    }

    /** Persist [updated] merged with the in-progress title / notes / tag edits. */
    fun save(updated: TaskEntity = task) {
        viewModel.updateTask(
            updated.copy(title = title.ifBlank { task.title }, notes = notes),
            allTags(),
        )
    }

    fun close() {
        save()
        onBack()
    }

    BackHandler { close() }

    val today = LocalDate.now()
    val done = task.completedAt != null
    val dueDate = dueDateOf(task)
    val dueTime = dueTimeOf(task)
    val currentList = task.listId?.let { id -> lists.firstOrNull { it.id == id } }
    val currentStatus = statuses.firstOrNull { it.id == task.statusId }
    val pageColor = pageBackground()
    val cardColor = groupCardColor()
    val accent = priorityColor(task.priority) ?: MaterialTheme.colorScheme.outline

    Scaffold(
        containerColor = pageColor,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = pageColor),
                title = {},
                navigationIcon = {
                    IconButton(onClick = { close() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { confirmDelete = true }) {
                        Icon(
                            Icons.Filled.DeleteOutline,
                            "Delete task",
                            tint = MaterialTheme.colorScheme.error,
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 16.dp),
        ) {
            // ---- Hero: check, title, description --------------------------
            Row(Modifier.padding(start = 2.dp), verticalAlignment = Alignment.Top) {
                CheckCircle(
                    done = done,
                    accent = accent,
                    onClick = { viewModel.toggleComplete(task) },
                    modifier = Modifier.padding(top = 2.dp),
                    size = 26.dp,
                )
                Column(
                    Modifier
                        .weight(1f)
                        .padding(start = 4.dp, top = 7.dp),
                ) {
                    BasicTextField(
                        value = title,
                        onValueChange = { title = it },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = MaterialTheme.typography.headlineSmall.copy(
                            color = if (done) {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                            textDecoration = if (done) TextDecoration.LineThrough else null,
                        ),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.secondary),
                        decorationBox = { inner ->
                            if (title.isEmpty()) {
                                Text(
                                    "Task name",
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = MaterialTheme.colorScheme.outline,
                                )
                            }
                            inner()
                        },
                    )
                    BasicTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                        textStyle = MaterialTheme.typography.bodyLarge.copy(
                            color = MaterialTheme.colorScheme.onSurface,
                        ),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.secondary),
                        minLines = 2,
                        decorationBox = { inner ->
                            if (notes.isEmpty()) {
                                Text(
                                    "Add a description…",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.outline,
                                )
                            }
                            inner()
                        },
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // ---- Schedule -----------------------------------------------
            GroupCard(cardColor) {
                PropertyRow(
                    label = "Due",
                    value = dueDate?.let { friendlyDay(it, today, long = true) } ?: "None",
                    muted = dueDate == null,
                    onClick = { showDatePicker = true },
                    leading = { RowIcon(Icons.Outlined.CalendarToday) },
                    trailing = if (dueDate != null) {
                        { ClearButton("Clear due date") { save(task.copy(dueAt = null, hasDueTime = false)) } }
                    } else {
                        null
                    },
                )
                if (dueDate != null) {
                    RowDivider()
                    PropertyRow(
                        label = "Time",
                        value = dueTime?.let { friendlyTime(it) } ?: "None",
                        muted = dueTime == null,
                        onClick = { showTimePicker = true },
                        leading = { RowIcon(Icons.Outlined.Schedule) },
                        trailing = if (dueTime != null) {
                            {
                                ClearButton("Clear time") {
                                    save(task.copy(dueAt = dueDate.toString(), hasDueTime = false))
                                }
                            }
                        } else {
                            null
                        },
                    )
                }
                RowDivider()
                PropertyRow(
                    label = "Repeat",
                    value = Recurrence.fromWire(task.recurrence)?.label ?: "Never",
                    muted = task.recurrence == null,
                    onClick = { sheet = PickerSheet.Repeat },
                    leading = { RowIcon(Icons.Outlined.Repeat) },
                )
            }

            Spacer(Modifier.height(12.dp))

            // ---- Organise -----------------------------------------------
            GroupCard(cardColor) {
                PrioritySelector(task.priority) { save(task.copy(priority = it)) }
                RowDivider()
                PropertyRow(
                    label = "Status",
                    value = currentStatus?.name ?: "—",
                    onClick = { sheet = PickerSheet.Status },
                    leading = {
                        RowDot(currentStatus?.let { parseHexColor(it.color) }
                            ?: MaterialTheme.colorScheme.outline)
                    },
                )
                if (lists.isNotEmpty()) {
                    RowDivider()
                    PropertyRow(
                        label = "List",
                        value = currentList?.name ?: "No list",
                        muted = currentList == null,
                        onClick = { sheet = PickerSheet.ListPick },
                        leading = {
                            if (currentList != null) {
                                RowDot(parseHexColor(currentList.color))
                            } else {
                                RowIcon(Icons.Outlined.Inbox)
                            }
                        },
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            // ---- Subtasks -----------------------------------------------
            GroupCard(cardColor) {
                val doneCount = subtasks.count { it.done }
                Row(
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RowIcon(Icons.Outlined.Checklist)
                    Spacer(Modifier.size(14.dp))
                    Text("Subtasks", style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.weight(1f))
                    if (subtasks.isNotEmpty()) {
                        Text(
                            "$doneCount of ${subtasks.size}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (subtasks.isNotEmpty()) {
                    LinearProgressIndicator(
                        progress = { doneCount.toFloat() / subtasks.size },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 50.dp, end = 16.dp, top = 6.dp, bottom = 6.dp)
                            .height(4.dp)
                            .clip(CircleShape),
                        color = MaterialTheme.colorScheme.secondary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant,
                        drawStopIndicator = {},
                    )
                }
                subtasks.forEach { subtask ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.toggleSubtask(subtask) }
                            .padding(start = 38.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = subtask.done,
                            onCheckedChange = { viewModel.toggleSubtask(subtask) },
                        )
                        Text(
                            subtask.title,
                            Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                            textDecoration = if (subtask.done) TextDecoration.LineThrough else null,
                            color = if (subtask.done) {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                        )
                        IconButton(onClick = { viewModel.deleteSubtask(subtask.id) }) {
                            Icon(
                                Icons.Filled.Close,
                                "Remove subtask",
                                Modifier.size(15.dp),
                                tint = MaterialTheme.colorScheme.outline,
                            )
                        }
                    }
                }
                fun addSubtask() {
                    if (newSubtask.isNotBlank()) {
                        viewModel.addSubtask(task.id, newSubtask.trim())
                        newSubtask = ""
                    }
                }
                Row(
                    Modifier.padding(start = 50.dp, end = 8.dp, top = 10.dp, bottom = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.Add,
                        null,
                        Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.outline,
                    )
                    Spacer(Modifier.size(10.dp))
                    InlineField(
                        value = newSubtask,
                        onValueChange = { newSubtask = it },
                        placeholder = "Add subtask",
                        onDone = { addSubtask() },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            // ---- Tags ---------------------------------------------------
            GroupCard(cardColor) {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RowIcon(Icons.Outlined.Label)
                        Spacer(Modifier.size(14.dp))
                        Text("Tags", style = MaterialTheme.typography.bodyLarge)
                    }
                    if (tagList.isNotEmpty()) {
                        FlowRow(
                            Modifier.padding(start = 34.dp, top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            tagList.forEach { tag ->
                                InputChip(
                                    selected = false,
                                    onClick = { tagList = tagList - tag },
                                    label = { Text("#$tag") },
                                    trailingIcon = {
                                        Icon(
                                            Icons.Filled.Close,
                                            "Remove $tag",
                                            Modifier.size(14.dp),
                                        )
                                    },
                                )
                            }
                        }
                    }
                    Row(
                        Modifier.padding(start = 34.dp, top = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        InlineField(
                            value = tagInput,
                            onValueChange = { value ->
                                tagInput = value
                                if (value.endsWith(" ") || value.endsWith(",")) commitTagInput()
                            },
                            placeholder = if (tagList.isEmpty()) "Add a tag" else "Add another",
                            onDone = { commitTagInput() },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                buildString {
                    append("Created ${friendlyDay(dateOf(task.createdAt), today)}")
                    if (task.updatedAt.take(10) != task.createdAt.take(10)) {
                        append("  ·  Updated ${friendlyDay(dateOf(task.updatedAt), today)}")
                    }
                    task.completedAt?.let { append("  ·  Completed ${friendlyDay(dateOf(it), today)}") }
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(start = 4.dp),
            )
            Spacer(Modifier.height(32.dp))
        }
    }

    // ---- Pickers --------------------------------------------------------
    when (sheet) {
        PickerSheet.Status -> OptionSheet(
            title = "Status",
            options = statuses.sortedBy { it.sortOrder }
                .map { SheetOption(it.id, it.name, parseHexColor(it.color)) },
            selected = task.statusId,
            onSelect = { save(task.copy(statusId = it)) },
            onDismiss = { sheet = null },
        )
        PickerSheet.ListPick -> OptionSheet(
            title = "List",
            options = listOf(SheetOption<String?>(null, "No list")) +
                lists.map { SheetOption<String?>(it.id, it.name, parseHexColor(it.color)) },
            selected = task.listId,
            onSelect = { save(task.copy(listId = it)) },
            onDismiss = { sheet = null },
        )
        PickerSheet.Repeat -> OptionSheet(
            title = "Repeat",
            options = listOf(SheetOption<String?>(null, "Never")) +
                Recurrence.entries.map { SheetOption<String?>(it.wireName, it.label) },
            selected = task.recurrence,
            onSelect = { wire ->
                save(
                    task.copy(
                        recurrence = wire,
                        dueAt = if (wire != null) task.dueAt ?: today.toString() else task.dueAt,
                    ),
                )
            },
            onDismiss = { sheet = null },
        )
        null -> Unit
    }

    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = dueDate
                ?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let { millis ->
                            val date = Instant.ofEpochMilli(millis)
                                .atZone(ZoneOffset.UTC).toLocalDate().toString()
                            val dueAt = if (task.hasDueTime && (task.dueAt?.length ?: 0) > 10) {
                                date + task.dueAt!!.substring(10)
                            } else {
                                date
                            }
                            save(task.copy(dueAt = dueAt))
                        }
                        showDatePicker = false
                    },
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = state)
        }
    }

    if (showTimePicker) {
        val state = rememberTimePickerState(
            initialHour = dueTime?.hour ?: 9,
            initialMinute = dueTime?.minute ?: 0,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        val date = dueDate?.toString() ?: today.toString()
                        val time = "%02d:%02d".format(state.hour, state.minute)
                        save(task.copy(dueAt = "${date}T$time:00", hasDueTime = true))
                        showTimePicker = false
                    },
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
            text = { TimePicker(state = state) },
        )
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete task?") },
            text = { Text("\"${task.title}\" will be removed from this device and from sync.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteTask(task.id)
                        confirmDelete = false
                        onBack()
                    },
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
}

// ---- Pieces ---------------------------------------------------------------

/** Label on the left, value on the right, chevron (or [trailing]) at the edge. */
@Composable
private fun PropertyRow(
    label: String,
    value: String,
    onClick: () -> Unit,
    leading: @Composable () -> Unit,
    muted: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(start = 16.dp, end = if (trailing == null) 10.dp else 4.dp)
            .height(52.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading()
        Spacer(Modifier.size(14.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.weight(1f))
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            color = if (muted) {
                MaterialTheme.colorScheme.outline
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
        )
        if (trailing != null) {
            trailing()
        } else {
            Spacer(Modifier.size(2.dp))
            Icon(
                Icons.Filled.ChevronRight,
                null,
                Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.outline,
            )
        }
    }
}

@Composable
private fun RowIcon(icon: ImageVector, tint: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Icon(icon, null, Modifier.size(20.dp), tint = tint)
}

@Composable
private fun RowDot(color: Color) {
    Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(10.dp).background(color, CircleShape))
    }
}

@Composable
private fun RowDivider() {
    HorizontalDivider(
        Modifier.padding(start = 50.dp),
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f),
    )
}

@Composable
private fun ClearButton(description: String, onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(
            Icons.Filled.Close,
            description,
            Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.outline,
        )
    }
}

/** Borderless single-line field used inside cards (add subtask, add tag). */
@Composable
private fun InlineField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium.copy(
            color = MaterialTheme.colorScheme.onSurface,
        ),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.secondary),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        decorationBox = { inner ->
            if (value.isEmpty()) {
                Text(
                    placeholder,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            inner()
        },
    )
}

@Composable
private fun PrioritySelector(priority: Int, onSelect: (Int) -> Unit) {
    val scheme = MaterialTheme.colorScheme
    Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RowIcon(Icons.Outlined.Flag, tint = priorityColor(priority) ?: scheme.onSurfaceVariant)
            Spacer(Modifier.size(14.dp))
            Text("Priority", style = MaterialTheme.typography.bodyLarge)
        }
        val options = listOf(0 to "None", 1 to "Low", 2 to "Medium", 3 to "High")
        SingleChoiceSegmentedButtonRow(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
        ) {
            options.forEachIndexed { index, (value, label) ->
                val tint = priorityColor(value)
                SegmentedButton(
                    selected = priority == value,
                    onClick = { onSelect(value) },
                    shape = SegmentedButtonDefaults.itemShape(index, options.size),
                    colors = SegmentedButtonDefaults.colors(
                        activeContainerColor = tint?.copy(alpha = 0.16f) ?: scheme.secondaryContainer,
                        activeContentColor = tint ?: scheme.onSecondaryContainer,
                        activeBorderColor = tint?.copy(alpha = 0.5f) ?: scheme.outlineVariant,
                        inactiveContainerColor = Color.Transparent,
                        inactiveContentColor = scheme.onSurfaceVariant,
                        inactiveBorderColor = scheme.outlineVariant,
                    ),
                    icon = {},
                ) {
                    Text(label, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> OptionSheet(
    title: String,
    options: List<SheetOption<T>>,
    selected: T?,
    onSelect: (T) -> Unit,
    onDismiss: () -> Unit,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        containerColor = groupCardColor(),
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(start = 24.dp, end = 24.dp, bottom = 8.dp),
        )
        val showDots = options.any { it.color != null }
        Column(Modifier.verticalScroll(rememberScrollState())) {
            options.forEach { option ->
                val isSelected = option.value == selected
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            onSelect(option.value)
                            onDismiss()
                        }
                        .padding(horizontal = 24.dp)
                        .height(52.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (showDots) {
                        if (option.color != null) RowDot(option.color) else Spacer(Modifier.size(20.dp))
                        Spacer(Modifier.size(14.dp))
                    }
                    Text(
                        option.label,
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyLarge,
                        color = if (isSelected) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                    if (isSelected) {
                        Icon(
                            Icons.Filled.Check,
                            "Selected",
                            Modifier.size(20.dp),
                            tint = MaterialTheme.colorScheme.secondary,
                        )
                    }
                }
            }
            Spacer(Modifier.height(28.dp))
            }
        }
    }

    private fun dateOf(iso: String): LocalDate =
        runCatching { LocalDate.parse(iso.take(10)) }.getOrDefault(LocalDate.now())
