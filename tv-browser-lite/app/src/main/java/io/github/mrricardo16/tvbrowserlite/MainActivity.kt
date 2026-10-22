package io.github.mrricardo16.tvbrowserlite

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.WebRequestError
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

/** GeckoView single-tab browser with persistent URL history and TV-friendly navigation controls. */
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
    private var lastLoadError: String? = null
    private val events = ArrayDeque<String>()

    private fun note(message: String) {
        if (events.size >= 30) events.removeFirst()
        events.addLast("${System.currentTimeMillis()}: $message")
    }

    private fun showDiagnostics() {
        val summary = "Android API: ${android.os.Build.VERSION.SDK_INT}\nABI: ${android.os.Build.SUPPORTED_ABIS.joinToString()}\nGeckoView: 157.0\n\n" +
            events.joinToString("\n")
        AlertDialog.Builder(this).setTitle("浏览器诊断（不含认证信息）")
            .setMessage(summary).setPositiveButton("关闭", null).show()
    }

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
        toolbar.addView(
            button("强刷") { forceRefresh() },
            LinearLayout.LayoutParams(dp(66), dp(48))
        )
        toolbar.addView(
            button("历史") { showHistory() },
            LinearLayout.LayoutParams(dp(66), dp(48))
        )

        address = EditText(this).apply {
            setSingleLine(true)
            hint = getString(R.string.address_hint)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
        }
        address.onFocusChangeListener = View.OnFocusChangeListener { _, hasFocus ->
            if (hasFocus && ::session.isInitialized) session.setFocused(false)
        }
        toolbar.addView(address, LinearLayout.LayoutParams(0, dp(50), 1f))
        toolbar.addView(button("前往") { navigate() }, LinearLayout.LayoutParams(dp(64), dp(48)))
        toolbar.addView(button("诊断") { showDiagnostics() }, LinearLayout.LayoutParams(dp(64), dp(48)))
        root.addView(toolbar)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))

        geckoView = GeckoView(this).apply {
            isFocusable = true
            isFocusableInTouchMode = true
        }
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
                    event.action == android.view.KeyEvent.ACTION_DOWN)
            ) {
                navigate()
                true
            } else false
        }

        try {
            val current = runtime ?: synchronized(MainActivity::class.java) {
                runtime ?: GeckoRuntime.create(applicationContext).also { runtime = it }
            }
            session = GeckoSession()
            session.setPromptDelegate(BrowserPromptDelegate(this))

            // Keep the TV's system IME connected to GeckoView when a website form field gains focus.
            // Request focus before showing the keyboard so Android can create the InputConnection.
            session.getTextInput().setDelegate(object : GeckoSession.TextInputDelegate {
                override fun showSoftInput(session: GeckoSession) {
                    geckoView.requestFocus()
                    session.setFocused(true)
                    geckoView.post {
                        val inputManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                        inputManager.showSoftInput(geckoView, InputMethodManager.SHOW_IMPLICIT)
                    }
                }

                override fun hideSoftInput(session: GeckoSession) {
                    val inputManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                    geckoView.windowToken?.let { inputManager.hideSoftInputFromWindow(it, 0) }
                }

                override fun restartInput(session: GeckoSession, reason: Int) {
                    val inputManager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                    geckoView.requestFocus()
                    inputManager.restartInput(geckoView)
                }
            })

            session.setContentDelegate(object : GeckoSession.ContentDelegate {
                override fun onCrash(session: GeckoSession) {
                    note("内容进程崩溃")
                    status.text = "网页渲染进程崩溃，请重新启动浏览器"
                }

                override fun onKill(session: GeckoSession) {
                    note("内容进程被系统结束")
                    status.text = "网页渲染进程已结束，请重新启动浏览器"
                }

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
                    if (!url.isNullOrBlank() &&
                        (url.startsWith("https://") || url.startsWith("http://"))
                    ) {
                        if (!address.hasFocus()) address.setText(url)
                        prefs.remember(url)
                    }
                }

                override fun onLoadError(
                    session: GeckoSession,
                    uri: String?,
                    error: WebRequestError
                ): GeckoResult<String>? {
                    lastLoadError = "网络/加载错误：类别 ${error.category}，代码 ${error.code}"
                    note(lastLoadError!!)
                    status.text = lastLoadError
                    return null // no certificate bypass or automatic redirection
                }

                override fun onLoadRequest(
                    session: GeckoSession,
                    request: GeckoSession.NavigationDelegate.LoadRequest
                ): GeckoResult<org.mozilla.geckoview.AllowOrDeny>? {
                    val uri = request.uri.lowercase(java.util.Locale.ROOT)
                    if (uri.startsWith("http://") || uri.startsWith("https://") || uri == "about:blank") {
                        return null
                    }
                    note("拒绝不支持的顶层协议")
                    status.text = "只允许 HTTP/HTTPS 网页导航"
                    return GeckoResult.deny()
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
                    lastLoadError = null
                    note("开始加载")
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
                    if (!success) status.text = lastLoadError ?: "网页加载未完成，请检查网络或网址"
                    if (success) note("主文档加载结束（不代表 Vue mount 成功）")
                }
            })
            session.open(current)
            geckoView.setSession(session)
            restoreLastPage()
        } catch (e: Exception) {
            note("内核初始化异常：${e.javaClass.simpleName}")
            status.text = "浏览器内核初始化失败：${e.javaClass.simpleName}"
        }
    }

    private fun updateNavigation() {
        backButton.isEnabled = canGoBack
        forwardButton.isEnabled = canGoForward
    }

    private fun restoreLastPage() {
        if (!::session.isInitialized) return
        val last = prefs.lastUrl
        if (last != null) {
            address.setText(last)
            geckoView.requestFocus()
            session.setFocused(true)
            session.loadUri(last)
        } else {
            address.setText("")
            address.requestFocus()
            session.setFocused(false)
            session.loadUri("about:blank")
            status.text = "请输入 HTTP 或 HTTPS 网址"
        }
    }

    private fun showHistory() {
        val entries = prefs.history
        if (entries.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("历史网址")
                .setMessage("暂无历史网址")
                .setPositiveButton("关闭", null)
                .show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("历史网址（最近 ${UrlHistory.MAX_ENTRIES} 条）")
            .setItems(entries.toTypedArray()) { _, index ->
                address.setText(entries[index])
                navigate()
            }
            .setNegativeButton("关闭", null)
            .show()
    }

    private fun forceRefresh() {
        if (!::session.isInitialized) return
        note("用户触发强制刷新（绕过缓存）")
        session.reload(GeckoSession.LOAD_FLAGS_BYPASS_CACHE)
    }

    private fun navigate() {
        if (!::session.isInitialized) return
        val url = try {
            UrlNormalizer.normalize(address.text.toString())
        } catch (e: IllegalArgumentException) {
            status.text = e.message ?: "网址无效"
            return
        }
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager)
            .hideSoftInputFromWindow(address.windowToken, 0)
        address.clearFocus()
        address.setText(url)
        geckoView.requestFocus()
        session.setFocused(true)
        session.loadUri(url)
    }

    @Deprecated("Use system back handling until Android TV model baseline is confirmed")
    override fun onBackPressed() {
        when {
            address.hasFocus() -> {
                address.clearFocus()
                geckoView.requestFocus()
                if (::session.isInitialized) session.setFocused(true)
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
