package com.dahoko.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.dahoko.android.data.TaskEntity
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

/*
 * Shared building blocks for the task list and task detail screens, so the
 * two read as one design: grouped cards on a tinted page, one check-circle,
 * one pill style, one way of saying "Tomorrow".
 */

internal fun parseHexColor(hex: String): Color = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (error: IllegalArgumentException) {
    Color.Gray
}

internal fun dueDateOf(task: TaskEntity): LocalDate? =
    task.dueAt?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

internal fun dueTimeOf(task: TaskEntity): LocalTime? =
    task.dueAt?.takeIf { task.hasDueTime && it.length >= 16 }
        ?.let { runCatching { LocalTime.parse(it.substring(11, 16)) }.getOrNull() }

private val weekdayFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEEE")
private val shortDateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d")
private val longDateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, MMM d")
private val yearDateFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
private val timeFormat: DateTimeFormatter = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

/** "Today", "Tomorrow", "Yesterday", a weekday within the week, else "Oct 28". */
internal fun friendlyDay(date: LocalDate, today: LocalDate, long: Boolean = false): String {
    val delta = ChronoUnit.DAYS.between(today, date)
    return when {
        delta == 0L -> "Today"
        delta == 1L -> "Tomorrow"
        delta == -1L -> "Yesterday"
        delta in 2..6 -> date.format(weekdayFormat)
        date.year != today.year -> date.format(yearDateFormat)
        long -> date.format(longDateFormat)
        else -> date.format(shortDateFormat)
    }
}

internal fun friendlyTime(time: LocalTime): String = time.format(timeFormat)

/** Page background: tinted in light so white cards lift off it; flat in dark. */
@Composable
internal fun pageBackground(): Color =
    if (isSystemInDarkTheme()) MaterialTheme.colorScheme.background
    else MaterialTheme.colorScheme.surfaceContainerLow

/** Card surface that sits on [pageBackground]. */
@Composable
internal fun groupCardColor(): Color =
    if (isSystemInDarkTheme()) MaterialTheme.colorScheme.surfaceContainerLow
    else MaterialTheme.colorScheme.surface

internal val GroupCardRadius: Dp = 14.dp

/** A rounded grouped card; children stack vertically. */
@Composable
internal fun GroupCard(
    color: Color = groupCardColor(),
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(GroupCardRadius))
            .background(color),
    ) { content() }
}

/** The completion control: a 40dp touch target around a coloured ring. */
@Composable
internal fun CheckCircle(
    done: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 22.dp,
) {
    Box(
        modifier
            .size(40.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(size)
                .background(
                    if (done) MaterialTheme.colorScheme.primary else Color.Transparent,
                    CircleShape,
                )
                .then(if (done) Modifier else Modifier.border(1.5.dp, accent, CircleShape)),
            contentAlignment = Alignment.Center,
        ) {
            if (done) {
                Icon(
                    Icons.Filled.Check,
                    "Completed",
                    Modifier.size(size * 0.62f),
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
        }
    }
}

internal enum class PillTone { Neutral, Accent, Error, Plain }

/** Small metadata pill: optional leading icon or colour dot, then a label. */
@Composable
internal fun MetaPill(
    text: String,
    icon: ImageVector? = null,
    dot: Color? = null,
    tone: PillTone = PillTone.Neutral,
) {
    val scheme = MaterialTheme.colorScheme
    val (bg, fg) = when (tone) {
        PillTone.Neutral -> scheme.surfaceVariant to scheme.onSurfaceVariant
        PillTone.Accent -> scheme.primaryContainer to scheme.onPrimaryContainer
        PillTone.Error -> scheme.errorContainer to scheme.onErrorContainer
        PillTone.Plain -> Color.Transparent to scheme.onSurfaceVariant
    }
    Row(
        Modifier
            .background(bg, RoundedCornerShape(6.dp))
            .padding(
                horizontal = if (tone == PillTone.Plain) 2.dp else 7.dp,
                vertical = 3.dp,
            ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            Icon(it, null, Modifier.size(12.dp), tint = fg)
            Spacer(Modifier.size(4.dp))
        }
        dot?.let {
            Box(Modifier.size(7.dp).background(it, CircleShape))
            Spacer(Modifier.size(5.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = fg, maxLines = 1)
    }
}
