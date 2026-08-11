package com.dahoko.android.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.dahoko.android.data.ListEntity
import com.dahoko.android.data.StatusEntity
import com.dahoko.android.data.SubtaskEntity
import com.dahoko.android.data.TaskEntity
import com.dahoko.android.domain.Recurrence
import com.dahoko.android.ui.AppViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Task detail as a right-anchored side panel — the mobile sibling of the
 * desktop's detail dialog. A fixed header (title) and footer (delete /
 * done) frame a scrollable middle, so actions never drift out of reach on
 * long tasks.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailSheet(
    viewModel: AppViewModel,
    task: TaskEntity,
    taskTags: List<String>,
    lists: List<ListEntity>,
    statuses: List<StatusEntity>,
    subtasks: List<SubtaskEntity>,
    onDismiss: () -> Unit,
) {
    var title by remember(task.id) { mutableStateOf(task.title) }
    var notes by remember(task.id) { mutableStateOf(task.notes) }
    var tagsText by remember(task.id) { mutableStateOf(taskTags.joinToString(" ")) }
    var newSubtask by remember(task.id) { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    fun parsedTags(): List<String> = tagsText
        .split(Regex("[,\\s]+"))
        .map { it.trim().removePrefix("#").lowercase() }
        .filter { it.isNotBlank() }
        .distinct()

    fun save(updated: TaskEntity = task) {
        viewModel.updateTask(
            updated.copy(title = title.ifBlank { task.title }, notes = notes),
            parsedTags(),
        )
    }

    val panelState = remember { MutableTransitionState(false).apply { targetState = true } }

    fun close() {
        save()
        panelState.targetState = false
    }

    // Let the slide-out finish before the dialog leaves composition.
    LaunchedEffect(panelState.targetState, panelState.isIdle) {
        if (!panelState.targetState && panelState.isIdle) onDismiss()
    }

    Dialog(
        onDismissRequest = { close() },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnClickOutside = false,
        ),
    ) {
        Box(Modifier.fillMaxSize()) {
            AnimatedVisibility(
                visibleState = panelState,
                enter = fadeIn(tween(160)),
                exit = fadeOut(tween(160)),
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.4f))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { close() },
                )
            }
            AnimatedVisibility(
                visibleState = panelState,
                modifier = Modifier.align(Alignment.CenterEnd),
                enter = slideInHorizontally(tween(240)) { it },
                exit = slideOutHorizontally(tween(200)) { it },
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(0.88f)
                        .widthIn(max = 400.dp)
                        .imePadding(),
                    shape = MaterialTheme.shapes.large.copy(
                        topEnd = CornerSize(0.dp),
                        bottomEnd = CornerSize(0.dp),
                    ),
                    color = MaterialTheme.colorScheme.surface,
                ) {
                    Column(Modifier.fillMaxHeight()) {
                        // Header: overline + close, then the title.
                        Row(
                            Modifier.padding(start = 24.dp, end = 8.dp, top = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionLabel("Task", topPadding = 0.dp)
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = { close() }) {
                                Icon(
                                    Icons.Filled.Close,
                                    "Close",
                                    Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        BasicTextField(
                            value = title,
                            onValueChange = { title = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp),
                            textStyle = MaterialTheme.typography.titleLarge.copy(
                                color = MaterialTheme.colorScheme.onSurface,
                            ),
                            cursorBrush = SolidColor(MaterialTheme.colorScheme.secondary),
                            maxLines = 3,
                            decorationBox = { innerTextField ->
                                if (title.isEmpty()) {
                                    Text(
                                        "Task name",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = MaterialTheme.colorScheme.outline,
                                    )
                                }
                                innerTextField()
                            },
                        )

                        // Scrollable middle.
                        Column(
                            Modifier
                                .weight(1f)
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 24.dp),
                        ) {
                            SectionLabel("Due")
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                FilterChip(
                                    selected = task.dueAt != null,
                                    onClick = { showDatePicker = true },
                                    label = { Text(task.dueAt?.take(10) ?: "Due date") },
                                )
                                if (task.dueAt != null) {
                                    FilterChip(
                                        selected = task.hasDueTime,
                                        onClick = { showTimePicker = true },
                                        label = {
                                            Text(
                                                if (task.hasDueTime && task.dueAt.length > 11) {
                                                    task.dueAt.substring(11).take(5)
                                                } else {
                                                    "Time"
                                                },
                                            )
                                        },
                                    )
                                    IconButton(
                                        onClick = {
                                            viewModel.updateTask(
                                                task.copy(dueAt = null, hasDueTime = false),
                                                parsedTags(),
                                            )
                                        },
                                    ) {
                                        Icon(
                                            Icons.Filled.Close,
                                            "Clear due date",
                                            Modifier.size(16.dp),
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }

                            SectionLabel("Priority")
                            Row(
                                Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                listOf(0 to "None", 1 to "Low", 2 to "Med", 3 to "High")
                                    .forEach { (value, label) ->
                                        FilterChip(
                                            selected = task.priority == value,
                                            onClick = {
                                                viewModel.updateTask(
                                                    task.copy(priority = value),
                                                    parsedTags(),
                                                )
                                            },
                                            label = { Text(label) },
                                        )
                                    }
                            }

                            SectionLabel("Status")
                            Row(
                                Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                statuses.forEach { status ->
                                    FilterChip(
                                        selected = task.statusId == status.id,
                                        onClick = {
                                            viewModel.updateTask(
                                                task.copy(statusId = status.id),
                                                parsedTags(),
                                            )
                                        },
                                        label = { Text(status.name) },
                                    )
                                }
                            }

                            if (lists.isNotEmpty()) {
                                SectionLabel("List")
                                Row(
                                    Modifier.horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    FilterChip(
                                        selected = task.listId == null,
                                        onClick = {
                                            viewModel.updateTask(
                                                task.copy(listId = null),
                                                parsedTags(),
                                            )
                                        },
                                        label = { Text("No list") },
                                    )
                                    lists.forEach { list ->
                                        FilterChip(
                                            selected = task.listId == list.id,
                                            onClick = {
                                                viewModel.updateTask(
                                                    task.copy(listId = list.id),
                                                    parsedTags(),
                                                )
                                            },
                                            label = { Text(list.name) },
                                        )
                                    }
                                }
                            }

                            SectionLabel("Repeat")
                            Row(
                                Modifier.horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                FilterChip(
                                    selected = task.recurrence == null,
                                    onClick = {
                                        viewModel.updateTask(
                                            task.copy(recurrence = null),
                                            parsedTags(),
                                        )
                                    },
                                    label = { Text("Once") },
                                )
                                Recurrence.entries.forEach { cadence ->
                                    FilterChip(
                                        selected = task.recurrence == cadence.wireName,
                                        onClick = {
                                            viewModel.updateTask(
                                                task.copy(
                                                    recurrence = cadence.wireName,
                                                    dueAt = task.dueAt
                                                        ?: LocalDate.now().toString(),
                                                ),
                                                parsedTags(),
                                            )
                                        },
                                        label = { Text(cadence.label) },
                                    )
                                }
                            }

                            SectionLabel("Tags")
                            OutlinedTextField(
                                value = tagsText,
                                onValueChange = { tagsText = it },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = { Text("#home #errand") },
                                textStyle = MaterialTheme.typography.bodyMedium,
                                singleLine = true,
                            )

                            SectionLabel("Subtasks")
                            subtasks.forEach { subtask ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = subtask.done,
                                        onCheckedChange = { viewModel.toggleSubtask(subtask) },
                                    )
                                    Text(
                                        subtask.title,
                                        Modifier.weight(1f),
                                        style = MaterialTheme.typography.bodyMedium,
                                        textDecoration = if (subtask.done) {
                                            TextDecoration.LineThrough
                                        } else {
                                            null
                                        },
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
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                OutlinedTextField(
                                    value = newSubtask,
                                    onValueChange = { newSubtask = it },
                                    modifier = Modifier.weight(1f),
                                    placeholder = { Text("Add subtask") },
                                    textStyle = MaterialTheme.typography.bodyMedium,
                                    singleLine = true,
                                )
                                IconButton(
                                    onClick = {
                                        if (newSubtask.isNotBlank()) {
                                            viewModel.addSubtask(task.id, newSubtask.trim())
                                            newSubtask = ""
                                        }
                                    },
                                ) {
                                    Icon(Icons.Filled.Add, "Add subtask")
                                }
                            }

                            SectionLabel("Notes")
                            OutlinedTextField(
                                value = notes,
                                onValueChange = { notes = it },
                                modifier = Modifier.fillMaxWidth(),
                                placeholder = { Text("Notes…") },
                                textStyle = MaterialTheme.typography.bodyMedium,
                                minLines = 2,
                            )
                            Spacer(Modifier.height(20.dp))
                        }

                        // Fixed footer.
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            TextButton(
                                onClick = { confirmDelete = true },
                                colors = ButtonDefaults.textButtonColors(
                                    contentColor = MaterialTheme.colorScheme.error,
                                ),
                            ) {
                                Icon(Icons.Filled.Delete, null, Modifier.size(17.dp))
                                Spacer(Modifier.size(6.dp))
                                Text("Delete")
                            }
                            Spacer(Modifier.weight(1f))
                            Button(onClick = { close() }) {
                                Text("Done")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = task.dueAt
                ?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
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
                            viewModel.updateTask(task.copy(dueAt = dueAt), parsedTags())
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
        val initial = task.dueAt?.takeIf { task.hasDueTime && it.length > 11 }?.substring(11, 16)
        val state = rememberTimePickerState(
            initialHour = initial?.take(2)?.toIntOrNull() ?: 9,
            initialMinute = initial?.drop(3)?.toIntOrNull() ?: 0,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        val date = task.dueAt?.take(10) ?: LocalDate.now().toString()
                        val time = "%02d:%02d".format(state.hour, state.minute)
                        viewModel.updateTask(
                            task.copy(dueAt = "${date}T$time:00", hasDueTime = true),
                            parsedTags(),
                        )
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
                        onDismiss()
                    },
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun SectionLabel(text: String, topPadding: Dp = 18.dp) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = topPadding, bottom = 8.dp),
    )
}
