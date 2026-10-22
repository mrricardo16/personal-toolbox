package io.github.mrricardo16.tvbrowserlite

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
import android.app.AlertDialog
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.WebRequestError
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

/**
 * GeckoView browser designed for Android TV remotes without a pointer.
 *
 * TOOLBAR mode uses normal Android focus navigation. WEB mode maps D-pad keys to a virtual
 * cursor and synthetic touch events. GeckoView's default text-input integration is intentionally
 * retained so web form fields can request the system IME normally.
 */
class MainActivity : Activity() {
    private enum class FocusMode { TOOLBAR, WEB }

    companion object {
        @Volatile private var runtime: GeckoRuntime? = null
    }

    private lateinit var session: GeckoSession
    private lateinit var geckoView: GeckoView
    private lateinit var cursorView: TvRemoteCursorView
    private lateinit var address: EditText
    private lateinit var root: LinearLayout
    private lateinit var toolbar: LinearLayout
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView
    private lateinit var modeIndicator: TextView
    private lateinit var backButton: Button
    private lateinit var forwardButton: Button
    private lateinit var refreshButton: Button
    private lateinit var goButton: Button
    private lateinit var diagnosticsButton: Button
    private lateinit var forceRefreshButton: Button
    private lateinit var historyButton: Button
    private lateinit var prefs: BrowserPrefs

    private var focusMode = FocusMode.TOOLBAR
    private var canGoBack = false
    private var canGoForward = false
    private var isLoading = false
    private var lastLoadError: String? = null
    private var clickInProgress = false
    private var backKeyHandled = false
    private var maxRootHeight = 0
    private var legacyImeVisible = false
    private var lastImeVisible = false
    private var syntheticDownTime = 0L
    private var edgeSwipeAnimator: ValueAnimator? = null
    private val events = ArrayDeque<String>()

    private fun note(message: String) {
        if (events.size >= 30) events.removeFirst()
        events.addLast("${System.currentTimeMillis()}: $message")
    }

    private fun showDiagnostics() {
        val summary = "Android API: ${Build.VERSION.SDK_INT}\n" +
            "ABI: ${Build.SUPPORTED_ABIS.joinToString()}\n" +
            "GeckoView: 157.0\n" +
            "焦点模式: ${focusMode}\n" +
            "输入法可见: ${isImeVisible()}\n\n" +
            events.joinToString("\n")
        AlertDialog.Builder(this)
            .setTitle("浏览器诊断（不含认证信息）")
            .setMessage(summary)
            .setPositiveButton("关闭", null)
            .show()
    }

    private fun dp(value: Int): Int =
        (resources.displayMetrics.density * value + 0.5f).toInt()

    private fun button(label: String, action: () -> Unit): Button = Button(this).apply {
        id = View.generateViewId()
        text = label
        isAllCaps = false
        isFocusable = true
        isFocusableInTouchMode = true
        minWidth = 0
        minimumWidth = 0
        setPadding(dp(6), 0, dp(6), 0)
        backgroundTintList = ColorStateList.valueOf(0xFFE2E8F0.toInt())
        setOnFocusChangeListener { _, hasFocus ->
            backgroundTintList = ColorStateList.valueOf(
                if (hasFocus) 0xFF9CCBFF.toInt() else 0xFFE2E8F0.toInt()
            )
        }
        setOnClickListener { action() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = BrowserPrefs(this)

        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            isFocusableInTouchMode = true
            setBackgroundColor(0xFFEDF1F6.toInt())
        }
        toolbar = LinearLayout(this).apply {
            id = View.generateViewId()
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(6), dp(4), dp(6), dp(4))
        }

        backButton = button("‹") { if (canGoBack && ::session.isInitialized) session.goBack() }
        forwardButton = button("›") { if (canGoForward && ::session.isInitialized) session.goForward() }
        refreshButton = button("⟳") {
            if (::session.isInitialized) {
                if (isLoading) session.stop() else session.reload()
            }
        }
        toolbar.addView(backButton, LinearLayout.LayoutParams(dp(50), dp(48)))
        toolbar.addView(forwardButton, LinearLayout.LayoutParams(dp(50), dp(48)))
        toolbar.addView(refreshButton, LinearLayout.LayoutParams(dp(50), dp(48)))

        address = EditText(this).apply {
            id = View.generateViewId()
            setSingleLine(true)
            hint = getString(R.string.address_hint)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            isFocusable = true
            isFocusableInTouchMode = true
            setSelectAllOnFocus(true)
            backgroundTintList = ColorStateList.valueOf(0xFF9AA8B8.toInt())
            setOnFocusChangeListener { _, hasFocus ->
                backgroundTintList = ColorStateList.valueOf(
                    if (hasFocus) 0xFF2878C8.toInt() else 0xFF9AA8B8.toInt()
                )
                if (hasFocus) {
                    note("网址栏获得焦点")
                    if (focusMode == FocusMode.TOOLBAR) {
                        modeIndicator.text = "工具栏模式：确认网址栏可输入网址"
                    }
                }
            }
            setOnClickListener {
                if (focusMode == FocusMode.TOOLBAR) showAddressKeyboard()
            }
        }
        toolbar.addView(address, LinearLayout.LayoutParams(0, dp(50), 1f))
        goButton = button("前往") { navigate() }
        diagnosticsButton = button("诊断") { showDiagnostics() }
        toolbar.addView(goButton, LinearLayout.LayoutParams(dp(74), dp(48)))
        toolbar.addView(diagnosticsButton, LinearLayout.LayoutParams(dp(74), dp(48)))
        root.addView(toolbar)

        val featureToolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(6), 0, dp(6), 0)
        }
        modeIndicator = TextView(this).apply {
            setPadding(dp(8), 0, dp(8), 0)
            textSize = 12f
            setTextColor(0xFF263445.toInt())
            isFocusable = false
        }
        featureToolbar.addView(modeIndicator, LinearLayout.LayoutParams(0, dp(40), 1f))
        forceRefreshButton = button("强刷") { forceRefresh() }
        historyButton = button("历史") { showHistory() }
        featureToolbar.addView(forceRefreshButton, LinearLayout.LayoutParams(dp(80), dp(40)))
        featureToolbar.addView(historyButton, LinearLayout.LayoutParams(dp(80), dp(40)))
        root.addView(featureToolbar, LinearLayout.LayoutParams(-1, dp(44)))

        // Explicit focus links keep the URL field and navigation buttons reachable with a D-pad.
        val row = listOf<View>(backButton, forwardButton, refreshButton, address, goButton, diagnosticsButton)
        row.forEachIndexed { index, view ->
            if (index > 0) view.nextFocusLeftId = row[index - 1].id
            if (index < row.lastIndex) view.nextFocusRightId = row[index + 1].id
            view.nextFocusDownId = if (index < 4) forceRefreshButton.id else historyButton.id
        }
        forceRefreshButton.nextFocusUpId = address.id
        historyButton.nextFocusUpId = goButton.id
        forceRefreshButton.nextFocusRightId = historyButton.id
        historyButton.nextFocusLeftId = forceRefreshButton.id

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(3)))

        val webContainer = FrameLayout(this)
        geckoView = GeckoView(this).apply {
            id = View.generateViewId()
            isFocusable = true
            isFocusableInTouchMode = true
            setOnFocusChangeListener { _, hasFocus ->
                note("网页视图焦点=$hasFocus")
                if (::session.isInitialized) session.setFocused(hasFocus && focusMode == FocusMode.WEB)
            }
        }
        cursorView = TvRemoteCursorView(this)
        webContainer.addView(
            geckoView,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        )
        webContainer.addView(
            cursorView,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        )
        root.addView(webContainer, LinearLayout.LayoutParams(-1, 0, 1f))

        status = TextView(this).apply {
            setPadding(dp(12), dp(5), dp(12), dp(5))
            text = "请输入 HTTP 或 HTTPS 网址"
            setSingleLine(true)
            setTextColor(0xFF263445.toInt())
        }
        root.addView(status)
        setContentView(root)

        root.viewTreeObserver.addOnGlobalLayoutListener {
            val height = root.height
            if (height > maxRootHeight) maxRootHeight = height
            if (Build.VERSION.SDK_INT < 30 && maxRootHeight > 0) {
                legacyImeVisible = maxRootHeight - height > dp(120)
            }
            val imeNow = isImeVisible()
            if (imeNow != lastImeVisible) {
                lastImeVisible = imeNow
                note(if (imeNow) "系统输入法显示" else "系统输入法隐藏")
            }
        }

        address.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_GO ||
                (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)
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
                    return null
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
            session.loadUri(last)
            enterWebMode(resetCursor = true)
        } else {
            address.setText("")
            session.loadUri("about:blank")
            enterToolbarMode(selectAddress = false)
        }
    }

    private fun isImeVisible(): Boolean {
        return if (Build.VERSION.SDK_INT >= 30) {
            window.decorView.rootWindowInsets?.isVisible(WindowInsets.Type.ime()) == true
        } else {
            legacyImeVisible
        }
    }

    private fun inputMethodManager(): InputMethodManager =
        getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager

    private fun showAddressKeyboard() {
        if (focusMode != FocusMode.TOOLBAR) return
        address.requestFocus()
        address.post {
            inputMethodManager().showSoftInput(address, InputMethodManager.SHOW_IMPLICIT)
        }
        note("请求显示网址栏输入法")
    }

    private fun enterToolbarMode(selectAddress: Boolean = true) {
        focusMode = FocusMode.TOOLBAR
        cancelSyntheticClick()
        cursorView.setCursorVisible(false)
        modeIndicator.text = "工具栏模式：方向键选择；确认网址栏可输入"
        toolbar.setBackgroundColor(0xFFD7E5F5.toInt())
        if (::geckoView.isInitialized) geckoView.clearFocus()
        if (::session.isInitialized) session.setFocused(false)
        address.requestFocus()
        if (selectAddress && address.text.isNotEmpty()) {
            address.setSelection(0, address.text.length)
        }
        note("切换到工具栏模式")
    }

    private fun enterWebMode(resetCursor: Boolean) {
        focusMode = FocusMode.WEB
        inputMethodManager().hideSoftInputFromWindow(address.windowToken, 0)
        address.clearFocus()
        geckoView.requestFocus()
        if (::session.isInitialized) session.setFocused(true)
        if (resetCursor) cursorView.resetAndShow() else cursorView.setCursorVisible(true)
        modeIndicator.text = "网页模式：方向键移动光标；返回键回到网址栏"
        toolbar.setBackgroundColor(0xFFEDF1F6.toInt())
        note("切换到网页模式")
    }

    private fun handleToolbarAddressKeys(event: KeyEvent): Boolean {
        if (focusMode != FocusMode.TOOLBAR || !address.hasFocus()) return false
        if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            event.keyCode == KeyEvent.KEYCODE_ENTER ||
            event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
        ) {
            if (event.action == KeyEvent.ACTION_DOWN && !isImeVisible()) showAddressKeyboard()
            return true
        }

        if (event.keyCode != KeyEvent.KEYCODE_DPAD_LEFT &&
            event.keyCode != KeyEvent.KEYCODE_DPAD_RIGHT
        ) return false

        if (isImeVisible()) return false
        val selectionStart = address.selectionStart.coerceAtLeast(0)
        val selectionEnd = address.selectionEnd.coerceAtLeast(0)
        val atStart = minOf(selectionStart, selectionEnd) == 0
        val atEnd = maxOf(selectionStart, selectionEnd) >= address.text.length
        if (event.action == KeyEvent.ACTION_DOWN &&
            event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT && atStart
        ) {
            refreshButton.requestFocus()
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN &&
            event.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT && atEnd
        ) {
            goButton.requestFocus()
            return true
        }
        // At a text boundary, consume both key phases so the selection key-up cannot click another view.
        if ((event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT && atStart) ||
            (event.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT && atEnd)
        ) return true
        return false
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (backKeyHandled) {
                if (event.action == KeyEvent.ACTION_UP) backKeyHandled = false
                return true
            }
            if (event.action == KeyEvent.ACTION_DOWN && !isImeVisible() && focusMode == FocusMode.WEB) {
                backKeyHandled = true
                enterToolbarMode()
                return true
            }
        }

        // When the IME is visible, leave all key events to Android/IME instead of stealing them for the cursor.
        if (isImeVisible()) return super.dispatchKeyEvent(event)

        if (focusMode == FocusMode.WEB) {
            val direction = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> Pair(-1, 0)
                KeyEvent.KEYCODE_DPAD_RIGHT -> Pair(1, 0)
                KeyEvent.KEYCODE_DPAD_UP -> Pair(0, -1)
                KeyEvent.KEYCODE_DPAD_DOWN -> Pair(0, 1)
                else -> null
            }
            if (direction != null) {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    val step = if (event.repeatCount > 0) dp(38) else dp(28)
                    val edge = cursorView.moveBy(direction.first, direction.second, step)
                    if (edge.horizontal != 0 || edge.vertical != 0) performEdgeScroll(edge.horizontal, edge.vertical)
                }
                return true
            }

            if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                event.keyCode == KeyEvent.KEYCODE_ENTER ||
                event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
                event.keyCode == KeyEvent.KEYCODE_BUTTON_A
            ) {
                if (event.action == KeyEvent.ACTION_DOWN && !clickInProgress && event.repeatCount == 0) {
                    clickInProgress = true
                    cursorView.setCursorPressed(true)
                    dispatchCursorTouch(MotionEvent.ACTION_DOWN, cursorView.cursorX, cursorView.cursorY)
                } else if (event.action == KeyEvent.ACTION_UP && clickInProgress) {
                    dispatchCursorTouch(MotionEvent.ACTION_UP, cursorView.cursorX, cursorView.cursorY)
                    clickInProgress = false
                    cursorView.setCursorPressed(false)
                }
                return true
            }
        }

        if (handleToolbarAddressKeys(event)) return true
        return super.dispatchKeyEvent(event)
    }

    private fun dispatchCursorTouch(action: Int, x: Float, y: Float) {
        if (action == MotionEvent.ACTION_DOWN) syntheticDownTime = SystemClock.uptimeMillis()
        val now = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            syntheticDownTime,
            now,
            action,
            x,
            y,
            0
        )
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try {
            geckoView.dispatchTouchEvent(event)
        } finally {
            event.recycle()
        }
    }

    private fun cancelSyntheticClick() {
        if (!clickInProgress || !::cursorView.isInitialized || !::geckoView.isInitialized) return
        dispatchCursorTouch(MotionEvent.ACTION_CANCEL, cursorView.cursorX, cursorView.cursorY)
        clickInProgress = false
        cursorView.setCursorPressed(false)
    }

    private fun performEdgeScroll(horizontal: Int, vertical: Int) {
        if (edgeSwipeAnimator?.isRunning == true || geckoView.width <= 0 || geckoView.height <= 0) return
        val width = geckoView.width.toFloat()
        val height = geckoView.height.toFloat()
        var startX = width * 0.5f
        var endX = startX
        var startY = height * 0.5f
        var endY = startY

        when {
            vertical < 0 -> {
                startY = height * 0.35f
                endY = height * 0.68f
            }
            vertical > 0 -> {
                startY = height * 0.68f
                endY = height * 0.35f
            }
        }
        when {
            horizontal < 0 -> {
                startX = width * 0.35f
                endX = width * 0.68f
            }
            horizontal > 0 -> {
                startX = width * 0.68f
                endX = width * 0.35f
            }
        }

        val downTime = SystemClock.uptimeMillis()
        dispatchCursorTouchAt(MotionEvent.ACTION_DOWN, startX, startY, downTime)
        var cancelled = false
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 180L
            addUpdateListener { animation ->
                val fraction = animation.animatedValue as Float
                dispatchCursorTouchAt(
                    MotionEvent.ACTION_MOVE,
                    startX + (endX - startX) * fraction,
                    startY + (endY - startY) * fraction,
                    downTime
                )
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationCancel(animation: Animator) {
                    cancelled = true
                    dispatchCursorTouchAt(MotionEvent.ACTION_CANCEL, endX, endY, downTime)
                }

                override fun onAnimationEnd(animation: Animator) {
                    if (!cancelled) dispatchCursorTouchAt(MotionEvent.ACTION_UP, endX, endY, downTime)
                    edgeSwipeAnimator = null
                }
            })
        }
        edgeSwipeAnimator = animator
        animator.start()
    }

    private fun dispatchCursorTouchAt(action: Int, x: Float, y: Float, downTime: Long) {
        val event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, x, y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        try {
            geckoView.dispatchTouchEvent(event)
        } finally {
            event.recycle()
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
            .setItems(entries.toTypedArray()) { dialog, index ->
                dialog.dismiss()
                address.setText(entries[index])
                address.post { navigate() }
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
            enterToolbarMode(selectAddress = false)
            return
        }

        inputMethodManager().hideSoftInputFromWindow(address.windowToken, 0)
        address.setText(url)
        prefs.remember(url)
        session.loadUri(url)
        enterWebMode(resetCursor = true)
    }

    @Deprecated("Android TV back-key behavior is handled in dispatchKeyEvent where possible")
    override fun onBackPressed() {
        if (isImeVisible()) {
            inputMethodManager().hideSoftInputFromWindow(window.decorView.windowToken, 0)
            return
        }
        when (focusMode) {
            FocusMode.WEB -> enterToolbarMode()
            FocusMode.TOOLBAR -> {
                if (::session.isInitialized && canGoBack) session.goBack()
                else super.onBackPressed()
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        note("窗口焦点=$hasFocus")
        if (hasFocus && focusMode == FocusMode.WEB && ::cursorView.isInitialized) {
            cursorView.setCursorVisible(true)
        }
    }

    override fun onDestroy() {
        edgeSwipeAnimator?.cancel()
        cancelSyntheticClick()
        if (::session.isInitialized) {
            geckoView.releaseSession()
            session.close()
        }
        super.onDestroy()
    }
}
