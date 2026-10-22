package io.github.mrricardo16.tvbrowserlite

/**
 * Pure helpers for the small, persistent recent-URL list.
 *
 * The list is separate from GeckoSession's back/forward history. New entries
 * are placed first, duplicates are moved to the front, and only HTTP(S) URLs
 * are retained.
 */
internal object UrlHistory {
    const val MAX_ENTRIES = 50

    fun parse(serialized: String?): List<String> {
        if (serialized.isNullOrBlank()) return emptyList()
        return serialized.lineSequence()
            .map { it.trim() }
            .filter(::isHttpUrl)
            .distinct()
            .take(MAX_ENTRIES)
            .toList()
    }

    fun add(existing: List<String>, url: String): List<String> {
        val validExisting = existing.filter(::isHttpUrl)
        if (!isHttpUrl(url)) return validExisting.distinct().take(MAX_ENTRIES)
        return (listOf(url) + validExisting.filterNot { it == url })
            .distinct()
            .take(MAX_ENTRIES)
    }

    fun serialize(history: List<String>): String =
        history.filter(::isHttpUrl).distinct().take(MAX_ENTRIES).joinToString("\n")

    private fun isHttpUrl(url: String): Boolean =
        url.startsWith("http://", ignoreCase = true) ||
            url.startsWith("https://", ignoreCase = true)
}
