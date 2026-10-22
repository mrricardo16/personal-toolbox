package io.github.mrricardo16.tvbrowserlite

import android.content.Context

class BrowserPrefs(context: Context) {
    private val store = context.getSharedPreferences("browser_settings", Context.MODE_PRIVATE)

    val lastUrl: String? get() = store.getString("last_url", null)

    val history: List<String>
        get() = UrlHistory.parse(store.getString(HISTORY_KEY, null))

    fun remember(url: String) {
        if (url.startsWith("http://", ignoreCase = true) ||
            url.startsWith("https://", ignoreCase = true)
        ) {
            val updatedHistory = UrlHistory.add(history, url)
            store.edit()
                .putString("last_url", url)
                .putString(HISTORY_KEY, UrlHistory.serialize(updatedHistory))
                .apply()
        }
    }

    fun clear() = store.edit().clear().apply()

    private companion object {
        const val HISTORY_KEY = "history_urls"
    }
}
