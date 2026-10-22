package io.github.mrricardo16.tvbrowserlite

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View

/** Transparent overlay that draws the D-pad virtual cursor over GeckoView. */
internal class TvRemoteCursorView(context: Context) : View(context) {
    private val radius = context.resources.displayMetrics.density * 11f
    private val stroke = context.resources.displayMetrics.density * 2f
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        alpha = 238
        style = Paint.Style.FILL
    }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.BLACK
        alpha = 220
        style = Paint.Style.STROKE
        strokeWidth = stroke
    }
    private val centerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(30, 112, 210)
        style = Paint.Style.FILL
    }

    var cursorX: Float = 0f
        private set
    var cursorY: Float = 0f
        private set
    private var initialized = false
    private var cursorVisible = false
    private var pressed = false

    init {
        isFocusable = false
        isFocusableInTouchMode = false
        isClickable = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        setWillNotDraw(false)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (!initialized && w > 0 && h > 0) {
            cursorX = w / 2f
            cursorY = h / 2f
            initialized = true
        } else if (w > 0 && h > 0) {
            cursorX = cursorX.coerceIn(radius, (w - radius).coerceAtLeast(radius))
            cursorY = cursorY.coerceIn(radius, (h - radius).coerceAtLeast(radius))
        }
        invalidate()
    }

    fun resetAndShow() {
        if (width > 0 && height > 0) {
            cursorX = width / 2f
            cursorY = height / 2f
            initialized = true
        }
        cursorVisible = true
        pressed = false
        invalidate()
    }

    fun setCursorVisible(visible: Boolean) {
        cursorVisible = visible
        invalidate()
    }

    fun setPressed(value: Boolean) {
        pressed = value
        invalidate()
    }

    fun moveBy(dx: Int, dy: Int, step: Int): CursorMoveResult {
        if (!cursorVisible) resetAndShow()
        val result = RemoteCursorMath.move(
            x = cursorX,
            y = cursorY,
            width = width,
            height = height,
            dx = dx,
            dy = dy,
            step = step.toFloat(),
            margin = radius
        )
        cursorX = result.x
        cursorY = result.y
        invalidate()
        return result
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!cursorVisible || width <= 0 || height <= 0) return
        val currentRadius = if (pressed) radius * 0.78f else radius
        canvas.drawCircle(cursorX, cursorY, currentRadius, fillPaint)
        canvas.drawCircle(cursorX, cursorY, currentRadius, strokePaint)
        canvas.drawCircle(cursorX, cursorY, radius * 0.22f, centerPaint)
    }
}

internal data class CursorMoveResult(
    val x: Float,
    val y: Float,
    /** -1 means the cursor was already at the left edge; 1 means it was at the right edge. */
    val horizontal: Int,
    /** -1 means the cursor was already at the top edge; 1 means it was at the bottom edge. */
    val vertical: Int
)

/** Pure cursor movement math so bounds and edge behavior can be covered by JVM tests. */
internal object RemoteCursorMath {
    fun move(
        x: Float,
        y: Float,
        width: Int,
        height: Int,
        dx: Int,
        dy: Int,
        step: Float,
        margin: Float
    ): CursorMoveResult {
        if (width <= 0 || height <= 0) {
            return CursorMoveResult(x, y, 0, 0)
        }
        val minX = margin.coerceAtMost(width / 2f)
        val maxX = (width - margin).coerceAtLeast(minX)
        val minY = margin.coerceAtMost(height / 2f)
        val maxY = (height - margin).coerceAtLeast(minY)

        val edgeX = when {
            dx < 0 && x <= minX + 1f -> -1
            dx > 0 && x >= maxX - 1f -> 1
            else -> 0
        }
        val edgeY = when {
            dy < 0 && y <= minY + 1f -> -1
            dy > 0 && y >= maxY - 1f -> 1
            else -> 0
        }

        return CursorMoveResult(
            x = (x + dx * step).coerceIn(minX, maxX),
            y = (y + dy * step).coerceIn(minY, maxY),
            horizontal = edgeX,
            vertical = edgeY
        )
    }
}
