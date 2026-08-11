package com.dahoko.android.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.ListEntity
import com.dahoko.android.ui.AppViewModel
import com.dahoko.android.ui.theme.priorityColor

/**
 * Task composer. One source of truth — the text — with two layers of help:
 * live chips showing what the quick-add syntax already understood, and
 * tap-to-insert suggestions that append tokens instead of maintaining a
 * separate form state. The syntax teaches itself by watching.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickAddSheet(
    viewModel: AppViewModel,
    listsById: Map<String, ListEntity>,
    onDismiss: () -> Unit,
) {
    var input by remember { mutableStateOf(TextFieldValue("")) }
    val focusRequester = remember { FocusRequester() }
    val parsed = viewModel.previewQuickAdd(input.text)

    fun submit() {
        if (parsed.title.isNotBlank()) {
            viewModel.quickAdd(input.text)
            onDismiss()
        }
    }

    fun insertToken(token: String) {
        val text = input.text.trimEnd()
        val next = if (text.isEmpty()) token else "$text $token"
        input = TextFieldValue(next, selection = TextRange(next.length))
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .imePadding(),
        ) {
            Text(
                "NEW TASK",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))

            BasicTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
                textStyle = MaterialTheme.typography.titleLarge.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                maxLines = 3,
                decorationBox = { innerTextField ->
                    if (input.text.isEmpty()) {
                        Text(
                            "What needs doing?",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.outline,
                        )
                    }
                    innerTextField()
                },
            )

            // What the syntax understood, mirrored back immediately.
            val understood = parsed.dueDate != null || parsed.recurrence != null ||
                parsed.priority > 0 || parsed.tags.isNotEmpty()
            if (understood) {
                Spacer(Modifier.height(12.dp))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    parsed.dueDate?.let { date ->
                        ParsedChip(
                            icon = Icons.Filled.CalendarMonth,
                            label = friendlyDate(date),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                    parsed.dueTime?.let { time ->
                        ParsedChip(
                            icon = Icons.Filled.Schedule,
                            label = time,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                    parsed.recurrence?.let { recurrence ->
                        ParsedChip(
                            icon = Icons.Filled.Repeat,
                            label = recurrence.label,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (parsed.priority > 0) {
                        ParsedChip(
                            icon = Icons.Filled.Flag,
                            label = listOf("", "Low", "Medium", "High")[parsed.priority],
                            tint = priorityColor(parsed.priority)
                                ?: MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    parsed.tags.forEach { tag ->
                        ParsedChip(
                            icon = Icons.Filled.Tag,
                            label = tag,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Tap to append a token — no separate form state to reconcile.
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (parsed.dueDate == null) {
                    InsertChip("Today") { insertToken("today") }
                    InsertChip("Tomorrow") { insertToken("tomorrow") }
                    InsertChip("Monday") { insertToken("monday") }
                }
                if (parsed.priority == 0) {
                    InsertChip("!high") { insertToken("!high") }
                }
                if (parsed.recurrence == null) {
                    InsertChip("every week") { insertToken("every week") }
                }
                InsertChip("#tag") { insertToken("#") }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = { submit() },
                enabled = parsed.title.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Filled.Add, null, Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Add task")
            }
            Spacer(Modifier.height(24.dp))
        }
    }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }
}

@Composable
private fun ParsedChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color,
) {
    AssistChip(
        onClick = {},
        enabled = false,
        label = { Text(label) },
        leadingIcon = { Icon(icon, null, Modifier.size(15.dp), tint = tint) },
        colors = AssistChipDefaults.assistChipColors(
            disabledLabelColor = MaterialTheme.colorScheme.onSurface,
            disabledLeadingIconContentColor = tint,
        ),
    )
}

@Composable
private fun InsertChip(label: String, onClick: () -> Unit) {
    SuggestionChip(onClick = onClick, label = { Text(label) })
}

private fun friendlyDate(iso: String): String {
    val date = runCatching { java.time.LocalDate.parse(iso) }.getOrNull() ?: return iso
    val today = java.time.LocalDate.now()
    return when {
        date == today -> "Today"
        date == today.plusDays(1) -> "Tomorrow"
        date.isAfter(today) && date.isBefore(today.plusDays(7)) ->
            date.format(java.time.format.DateTimeFormatter.ofPattern("EEEE"))
        else -> date.format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
    }
}
