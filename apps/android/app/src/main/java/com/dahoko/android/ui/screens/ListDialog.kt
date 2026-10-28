package com.dahoko.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.ListEntity

/** Same palette as the desktop sidebar's list colour picker. */
private val LIST_COLORS = listOf(
    "#A3D0FF", "#2A7A5C", "#808FA0", "#D84A55", "#E8A33D", "#8E6BD1",
)

/**
 * Create or edit a list. With [existing] the dialog edits in place and
 * offers Delete (behind a confirmation); without it, it creates. Tasks in
 * a deleted list are kept and simply lose their list, as on desktop.
 */
@Composable
fun ListDialog(
    existing: ListEntity? = null,
    taskCount: Int = 0,
    onSave: (name: String, color: String) -> Unit,
    onDelete: (() -> Unit)? = null,
    onDismiss: () -> Unit,
) {
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var color by remember(existing?.id) {
        mutableStateOf(existing?.color?.takeIf { it in LIST_COLORS } ?: LIST_COLORS.first())
    }
    var confirmDelete by remember { mutableStateOf(false) }

    if (confirmDelete && existing != null && onDelete != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete \"${existing.name}\"?") },
            text = {
                Text(
                    when (taskCount) {
                        0 -> "The list will be removed from this device and from sync."
                        1 -> "Its 1 task will be kept without a list."
                        else -> "Its $taskCount tasks will be kept without a list."
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmDelete = false
                        onDelete()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "New list" else "Edit list") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Name") },
                    singleLine = true,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LIST_COLORS.forEach { option ->
                        val selected = color == option
                        Box(
                            Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(parseHexColor(option))
                                .then(
                                    if (selected) {
                                        Modifier.border(
                                            2.5.dp,
                                            MaterialTheme.colorScheme.onSurface,
                                            CircleShape,
                                        )
                                    } else {
                                        Modifier
                                    },
                                )
                                .clickable { color = option },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) {
                                Icon(
                                    Icons.Filled.Check,
                                    null,
                                    Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.onSurface,
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (name.isNotBlank()) onSave(name.trim(), color) },
                enabled = name.isNotBlank(),
            ) { Text(if (existing == null) "Create" else "Save") }
        },
        dismissButton = {
            Row {
                if (existing != null && onDelete != null) {
                    TextButton(
                        onClick = { confirmDelete = true },
                        colors = ButtonDefaults.textButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) { Text("Delete") }
                    Spacer(Modifier.width(4.dp))
                }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        },
    )
}
