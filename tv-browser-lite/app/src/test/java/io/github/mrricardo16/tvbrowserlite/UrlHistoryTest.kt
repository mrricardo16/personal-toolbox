package io.github.mrricardo16.tvbrowserlite

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlHistoryTest {
    @Test
    fun mostRecentUrlIsFirstAndDuplicatesMoveToFront() {
        val first = "https://example.com/one"
        val second = "https://example.com/two"

        assertEquals(listOf(second, first), UrlHistory.add(listOf(first, second), second))
    }

    @Test
    fun historyIsLimitedToFiftyEntries() {
        val existing = (0 until 60).map { "https://example.com/$it" }
        val result = UrlHistory.add(existing, "https://example.com/new")

        assertEquals(UrlHistory.MAX_ENTRIES, result.size)
        assertEquals("https://example.com/new", result.first())
        assertFalse(result.contains("https://example.com/59"))
    }

    @Test
    fun parseFiltersUnsupportedSchemesAndDuplicates() {
        val serialized = listOf(
            "https://example.com/a",
            "file:///tmp/private",
            "https://example.com/a",
            "http://192.168.1.10:8080/#/login"
        ).joinToString("\n")

        assertEquals(
            listOf("https://example.com/a", "http://192.168.1.10:8080/#/login"),
            UrlHistory.parse(serialized)
        )
    }

    @Test
    fun serializeAndParsePreserveQueryAndHash() {
        val urls = listOf("http://192.168.1.10:8080/?q=1#/login")
        assertEquals(urls, UrlHistory.parse(UrlHistory.serialize(urls)))
    }

    @Test
    fun emptyHistoryParsesAsEmpty() {
        assertTrue(UrlHistory.parse(null).isEmpty())
        assertTrue(UrlHistory.parse("").isEmpty())
    }
}
