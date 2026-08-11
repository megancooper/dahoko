package com.dahoko.android.domain

import java.time.DayOfWeek
import java.time.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Recurrence(val label: String) {
    @SerialName("daily") DAILY("Daily"),
    @SerialName("weekdays") WEEKDAYS("Weekdays"),
    @SerialName("weekly") WEEKLY("Weekly"),
    @SerialName("monthly") MONTHLY("Monthly");

    val wireName: String get() = label.lowercase()

    companion object {
        fun fromWire(value: String?): Recurrence? =
            entries.firstOrNull { it.wireName == value }
    }
}

private fun parseDay(iso: String): LocalDate = LocalDate.parse(iso.take(10))

/** The next due date (YYYY-MM-DD) after [fromIso] for the given cadence. */
fun nextOccurrence(fromIso: String, recurrence: Recurrence): String {
    var d = parseDay(fromIso)
    when (recurrence) {
        Recurrence.DAILY -> d = d.plusDays(1)
        Recurrence.WEEKDAYS -> {
            do {
                d = d.plusDays(1)
            } while (d.dayOfWeek == DayOfWeek.SATURDAY || d.dayOfWeek == DayOfWeek.SUNDAY)
        }
        Recurrence.WEEKLY -> d = d.plusWeeks(1)
        Recurrence.MONTHLY -> {
            // Clamp to the last day of the next month (Jan 31 -> Feb 28).
            val dayOfMonth = d.dayOfMonth
            val nextMonth = d.withDayOfMonth(1).plusMonths(1)
            d = nextMonth.withDayOfMonth(minOf(dayOfMonth, nextMonth.lengthOfMonth()))
        }
    }
    return d.toString()
}

/**
 * Whether a task anchored at [anchorIso] (its due date) is scheduled on
 * [dayIso] under the given cadence.
 */
fun isScheduledOn(anchorIso: String, recurrence: Recurrence, dayIso: String): Boolean {
    val anchor = parseDay(anchorIso)
    val day = parseDay(dayIso)
    return when (recurrence) {
        Recurrence.DAILY -> true
        Recurrence.WEEKDAYS -> day.dayOfWeek != DayOfWeek.SATURDAY && day.dayOfWeek != DayOfWeek.SUNDAY
        Recurrence.WEEKLY -> day.dayOfWeek == anchor.dayOfWeek
        Recurrence.MONTHLY -> day.dayOfMonth == anchor.dayOfMonth
    }
}
