package com.dahoko.android.domain

import java.time.LocalDate

/**
 * Port of the desktop quick-add parser (`@dahoko/core` quick-add.ts).
 * "Buy milk tomorrow at 15:00 #errand !p2" — date words, #tags, and
 * !priority markers are stripped from the title.
 */

data class QuickAddResult(
    val title: String,
    val tags: List<String>,
    val priority: Int,
    /** ISO date (YYYY-MM-DD), no time component */
    val dueDate: String?,
    /** HH:MM if a time was given alongside a date word */
    val dueTime: String?,
    val recurrence: Recurrence?,
)

private val PRIORITY_RE = Regex("""(?:^|\s)!(?:p([123])|(high|med|medium|low))(?=\s|$)""", RegexOption.IGNORE_CASE)
private val TAG_RE = Regex("""(?:^|\s)#([\p{L}\p{N}_-]+)""")
private val TIME_RE = Regex("""(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)""")
private val RECUR_WORD_RE = Regex("""(?:^|\s)(daily|weekdays|weekly|monthly)(?=\s|$)""", RegexOption.IGNORE_CASE)

private val WEEKDAYS = listOf(
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
)

private val EVERY_RE = Regex(
    "(?:^|\\s)every\\s+(day|weekday|week|month|" +
        WEEKDAYS.joinToString("|") + "|" +
        WEEKDAYS.joinToString("|") { it.take(3) } + ")(?=\\s|$)",
    RegexOption.IGNORE_CASE,
)

private data class DateMatch(val index: Int, val length: Int, val date: String)

/** Sunday-first day index to match JS `Date.getDay()`. */
private fun jsDay(date: LocalDate): Int = date.dayOfWeek.value % 7

/** Finds the last natural-language date reference in the text. */
private fun findDate(text: String, now: LocalDate): DateMatch? {
    val lower = text.lowercase()
    var best: DateMatch? = null

    fun consider(index: Int, length: Int, date: LocalDate) {
        if (index < 0) return
        val current = best
        if (current == null || index > current.index) {
            best = DateMatch(index, length, date.toString())
        }
    }

    val simple = listOf("today" to 0L, "tomorrow" to 1L, "tmr" to 1L)
    for ((word, offset) in simple) {
        val m = Regex("(?:^|\\s)$word(?=\\s|$)", RegexOption.IGNORE_CASE).find(lower)
        if (m != null) {
            val idx = m.range.first + (m.value.length - word.length)
            consider(idx, word.length, now.plusDays(offset))
        }
    }

    val weekdayRe = Regex(
        "(?:^|\\s)(next\\s+)?(" + WEEKDAYS.joinToString("|") + "|" +
            WEEKDAYS.joinToString("|") { it.take(3) } + ")(?=\\s|\$)",
        RegexOption.IGNORE_CASE,
    )
    val wm = weekdayRe.find(lower)
    if (wm != null) {
        val token = wm.groupValues[2]
        val target = WEEKDAYS.indexOfFirst { it.startsWith(token.take(3)) }
        if (target >= 0) {
            var delta = (target - jsDay(now) + 7) % 7
            if (delta == 0) delta = 7 // "monday" on a Monday means next week
            if (wm.groupValues[1].isNotEmpty()) delta += 7 // "next monday" skips the coming one
            val index = if (wm.range.first == 0) 0 else wm.range.first + 1
            consider(index, wm.value.trim().length, now.plusDays(delta.toLong()))
        }
    }

    // Explicit ISO date: 2026-08-01
    val im = Regex("""(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)""").find(text)
    if (im != null) {
        val date = runCatching {
            LocalDate.of(
                im.groupValues[1].toInt(),
                im.groupValues[2].toInt(),
                im.groupValues[3].toInt(),
            )
        }.getOrNull()
        if (date != null) {
            val index = if (im.range.first == 0) 0 else im.range.first + 1
            consider(index, im.value.trim().length, date)
        }
    }

    return best
}

fun parseQuickAdd(input: String, now: LocalDate = LocalDate.now()): QuickAddResult {
    var text = input.trim()

    var priority = 0
    val pm = PRIORITY_RE.find(text)
    if (pm != null) {
        priority = if (pm.groupValues[1].isNotEmpty()) {
            pm.groupValues[1].toInt()
        } else {
            when (pm.groupValues[2].lowercase()) {
                "high" -> 3
                "low" -> 1
                else -> 2
            }
        }
        text = text.replaceFirst(PRIORITY_RE, " ")
    }

    val tags = mutableListOf<String>()
    text = TAG_RE.replace(text) { m ->
        tags.add(m.groupValues[1].lowercase())
        " "
    }

    // Recurrence comes before date parsing so "every monday" isn't
    // swallowed by the weekday date matcher.
    var recurrence: Recurrence? = null
    var anchorWeekday: Int? = null
    val em = EVERY_RE.find(text)
    if (em != null) {
        when (val token = em.groupValues[1].lowercase()) {
            "day" -> recurrence = Recurrence.DAILY
            "weekday" -> recurrence = Recurrence.WEEKDAYS
            "week" -> recurrence = Recurrence.WEEKLY
            "month" -> recurrence = Recurrence.MONTHLY
            else -> {
                recurrence = Recurrence.WEEKLY
                anchorWeekday = WEEKDAYS.indexOfFirst { it.startsWith(token.take(3)) }
            }
        }
        text = text.replaceFirst(EVERY_RE, " ")
    } else {
        val rm = RECUR_WORD_RE.find(text)
        if (rm != null) {
            recurrence = Recurrence.fromWire(rm.groupValues[1].lowercase())
            text = text.replaceFirst(RECUR_WORD_RE, " ")
        }
    }

    val dateMatch = findDate(text, now)
    var dueDate: String? = null
    if (dateMatch != null) {
        dueDate = dateMatch.date
        text = text.substring(0, dateMatch.index) +
            text.substring(minOf(text.length, dateMatch.index + dateMatch.length))
    } else if (recurrence != null) {
        // Recurring tasks need a due-date anchor; default to the first
        // occurrence from today.
        dueDate = when {
            anchorWeekday != null ->
                now.plusDays(((anchorWeekday - jsDay(now) + 7) % 7).toLong()).toString()
            recurrence == Recurrence.WEEKDAYS && (jsDay(now) == 0 || jsDay(now) == 6) ->
                nextOccurrence(now.toString(), Recurrence.WEEKDAYS)
            else -> now.toString()
        }
    }

    var dueTime: String? = null
    if (dueDate != null) {
        val tm = TIME_RE.find(text)
        if (tm != null) {
            dueTime = "${tm.groupValues[1].padStart(2, '0')}:${tm.groupValues[2]}"
            text = text.replaceFirst(TIME_RE, " ")
        }
    }

    val title = text.replace(Regex("\\s+"), " ").trim()
    return QuickAddResult(title, tags, priority, dueDate, dueTime, recurrence)
}
