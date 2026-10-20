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

/**
 * M1: 独立 GeckoView 浏览器容器。
 * M2、M3 将扩展网址校验、导航控制、错误处理和网页对话框。
 */
class MainActivity : Activity() {
    companion object {
        @Volatile private var runtime: GeckoRuntime? = null
    }

    private lateinit var session: GeckoSession
    private lateinit var geckoView: GeckoView
    private lateinit var address: EditText
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFEDF1F6.toInt())
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(12, 8, 12, 8)
        }
        address = EditText(this).apply {
            setSingleLine(true)
            setText("https://www.mozilla.org/")
            hint = getString(R.string.address_hint)
            imeOptions = EditorInfo.IME_ACTION_GO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
            setSelectAllOnFocus(true)
        }
        toolbar.addView(address, LinearLayout.LayoutParams(0, 60, 1f))
        val go = Button(this).apply {
            text = getString(R.string.go)
            setOnClickListener { navigate() }
        }
        toolbar.addView(go)
        root.addView(toolbar)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, 4))
        geckoView = GeckoView(this)
        root.addView(geckoView, LinearLayout.LayoutParams(-1, 0, 1f))
        status = TextView(this).apply {
            text = "GeckoView 已准备就绪"
            setPadding(12, 5, 12, 5)
        }
        root.addView(status)
        setContentView(root)

        address.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
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
            session.setProgressDelegate(object : GeckoSession.ProgressDelegate {
                override fun onPageStart(session: GeckoSession, url: String) {
                    progress.progress = 0
                    progress.visibility = View.VISIBLE
                }
                override fun onProgressChange(session: GeckoSession, value: Int) {
                    progress.progress = value
                }
                override fun onPageStop(session: GeckoSession, success: Boolean) {
                    progress.visibility = View.GONE
                    if (!success) status.text = "页面加载失败"
                }
            })
            session.open(current)
            geckoView.setSession(session)
            status.text = "输入网址后点击前往"
        } catch (e: Exception) {
            status.text = "浏览器内核初始化失败：${e.javaClass.simpleName}"
            go.isEnabled = false
        }
    }

    private fun navigate() {
        if (::session.isInitialized) {
            val input = address.text.toString().trim()
            if (input.isNotEmpty()) session.loadUri(input)
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
