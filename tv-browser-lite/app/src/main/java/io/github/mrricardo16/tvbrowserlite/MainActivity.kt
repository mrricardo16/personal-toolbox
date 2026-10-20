package io.github.mrricardo16.tvbrowserlite

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

/** M2: GeckoView single-tab browser with navigable, editable HTTP(S) URL bar. */
class MainActivity : Activity() {
    companion object {
        @Volatile private var runtime: GeckoRuntime? = null
    }

    private lateinit var session: GeckoSession
    private lateinit var geckoView: GeckoView
    private lateinit var address: EditText
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView
    private lateinit var backButton: Button
    private lateinit var forwardButton: Button
    private lateinit var refreshButton: Button
    private lateinit var prefs: BrowserPrefs
    private var canGoBack = false
    private var canGoForward = false
    private var isLoading = false

    private fun dp(n: Int) = (resources.displayMetrics.density * n + 0.5f).toInt()
    private fun button(title: String, action: () -> Unit) = Button(this).apply {
        text = title
        isAllCaps = false
        minWidth = 0
        minimumWidth = 0
        setPadding(dp(6), 0, dp(6), 0)
        setOnClickListener { action() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = BrowserPrefs(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFEDF1F6.toInt())
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(6), dp(4), dp(6), dp(4))
        }

        backButton = button("‹") { if (canGoBack) session.goBack() }
        forwardButton = button("›") { if (canGoForward) session.goForward() }
        refreshButton = button("⟳") {
            if (::session.isInitialized) {
                if (isLoading) session.stop() else session.reload()
            }
        }
        toolbar.addView(backButton, LinearLayout.LayoutParams(dp(50), dp(48)))
        toolbar.addView(forwardButton, LinearLayout.LayoutParams(dp(50), dp(48)))
        toolbar.addView(refreshButton, LinearLayout.LayoutParams(dp(50), dp(48)))

        address = EditText(this).apply {
            setSingleLine(true)
            hint = getString(R.string.address_hint)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
        }
        toolbar.addView(address, LinearLayout.LayoutParams(0, dp(50), 1f))
        toolbar.addView(button("前往") { navigate() }, LinearLayout.LayoutParams(dp(74), dp(48)))
        toolbar.addView(button("主页") { showHome() }, LinearLayout.LayoutParams(dp(74), dp(48)))
        root.addView(toolbar)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))
        geckoView = GeckoView(this)
        root.addView(geckoView, LinearLayout.LayoutParams(-1, 0, 1f))
        status = TextView(this).apply {
            setPadding(dp(12), dp(5), dp(12), dp(5))
            text = "输入网址后点击前往"
            setSingleLine(true)
        }
        root.addView(status)
        setContentView(root)
        updateNavigation()

        address.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_GO ||
                (event?.keyCode == android.view.KeyEvent.KEYCODE_ENTER &&
                 event.action == android.view.KeyEvent.ACTION_DOWN)) {
                navigate()
                true
            } else false
        }

        try {
            val current = runtime ?: synchronized(MainActivity::class.java) {
                runtime ?: GeckoRuntime.create(applicationContext).also { runtime = it }
            }
            session = GeckoSession()
            session.setContentDelegate(object : GeckoSession.ContentDelegate {
                override fun onTitleChange(session: GeckoSession, title: String?) {
                    status.text = title ?: "网页"
                }
            })
            session.setNavigationDelegate(object : GeckoSession.NavigationDelegate {
                override fun onLocationChange(
                    session: GeckoSession,
                    url: String?,
                    perms: List<GeckoSession.PermissionDelegate.ContentPermission>,
                    hasUserGesture: Boolean
                ) {
                    if (!url.isNullOrBlank() && (url.startsWith("https://") || url.startsWith("http://"))) {
                        if (!address.hasFocus()) address.setText(url)
                        prefs.remember(url)
                    }
                }
                override fun onCanGoBack(session: GeckoSession, value: Boolean) {
                    canGoBack = value
                    updateNavigation()
                }
                override fun onCanGoForward(session: GeckoSession, value: Boolean) {
                    canGoForward = value
                    updateNavigation()
                }
            })
            session.setProgressDelegate(object : GeckoSession.ProgressDelegate {
                override fun onPageStart(session: GeckoSession, url: String) {
                    isLoading = true
                    refreshButton.text = "×"
                    progress.progress = 0
                    progress.visibility = View.VISIBLE
                    status.text = "正在加载网页…"
                }
                override fun onProgressChange(session: GeckoSession, value: Int) {
                    progress.progress = value
                }
                override fun onPageStop(session: GeckoSession, success: Boolean) {
                    isLoading = false
                    refreshButton.text = "⟳"
                    progress.visibility = View.GONE
                    if (!success) status.text = "加载未完成，请检查网络或网址"
                }
            })
            session.open(current)
            geckoView.setSession(session)
            showHome()
        } catch (e: Exception) {
            status.text = "浏览器内核初始化失败：${e.javaClass.simpleName}"
        }
    }

    private fun updateNavigation() {
        backButton.isEnabled = canGoBack
        forwardButton.isEnabled = canGoForward
    }

    private fun showHome() {
        if (!::session.isInitialized) return
        val last = prefs.lastUrl
        if (last != null) {
            address.setText(last)
            session.loadUri(last)
        } else {
            address.setText("")
            address.requestFocus()
            session.loadUri("about:blank")
            status.text = "请输入 HTTP 或 HTTPS 网址"
        }
    }

    private fun navigate() {
        if (!::session.isInitialized) return
        val url = try {
            UrlNormalizer.normalize(address.text.toString())
        } catch (e: IllegalArgumentException) {
            status.text = e.message ?: "网址无效"
            return
        }
        android.view.inputmethod.InputMethodManager::class.java.let {
            (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
                .hideSoftInputFromWindow(address.windowToken, 0)
        }
        address.clearFocus()
        address.setText(url)
        session.loadUri(url)
    }

    @Deprecated("Use system back handling until Android TV model baseline is confirmed")
    override fun onBackPressed() {
        when {
            address.hasFocus() -> {
                address.clearFocus()
                geckoView.requestFocus()
            }
            ::session.isInitialized && canGoBack -> session.goBack()
            else -> super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::session.isInitialized) {
            geckoView.releaseSession()
            session.close()
        }
        super.onDestroy()
    }
}
