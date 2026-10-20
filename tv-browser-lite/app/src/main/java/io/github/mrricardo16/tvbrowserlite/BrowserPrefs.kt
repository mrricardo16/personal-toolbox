package io.github.mrricardo16.tvbrowserlite

import android.content.Context

class BrowserPrefs(context: Context) {
    private val store = context.getSharedPreferences("browser_settings", Context.MODE_PRIVATE)
    val lastUrl: String? get() = store.getString("last_url", null)
    fun remember(url: String) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            store.edit().putString("last_url", url).apply()
        }
    }
    fun clear() = store.edit().clear().apply()
}
