package io.github.mrricardo16.tvbrowserlite

import org.junit.Assert.assertEquals
import org.junit.Test

class RemoteCursorMathTest {
    @Test
    fun cursorMovementIsClampedInsideViewport() {
        val left = RemoteCursorMath.move(
            x = 30f, y = 40f, width = 300, height = 200,
            dx = -1, dy = 0, step = 50f, margin = 10f
        )
        assertEquals(10f, left.x, 0.001f)
        assertEquals(40f, left.y, 0.001f)

        val bottomRight = RemoteCursorMath.move(
            x = 280f, y = 180f, width = 300, height = 200,
            dx = 1, dy = 1, step = 50f, margin = 10f
        )
        assertEquals(290f, bottomRight.x, 0.001f)
        assertEquals(190f, bottomRight.y, 0.001f)
    }

    @Test
    fun edgeScrollIsRequestedOnlyWhenAlreadyAtThatEdge() {
        val reachesEdge = RemoteCursorMath.move(
            x = 30f, y = 100f, width = 300, height = 200,
            dx = -1, dy = 0, step = 50f, margin = 10f
        )
        assertEquals(10f, reachesEdge.x, 0.001f)
        assertEquals(0, reachesEdge.horizontal)

        val pressesFurtherAtEdge = RemoteCursorMath.move(
            x = 10f, y = 100f, width = 300, height = 200,
            dx = -1, dy = 0, step = 50f, margin = 10f
        )
        assertEquals(10f, pressesFurtherAtEdge.x, 0.001f)
        assertEquals(-1, pressesFurtherAtEdge.horizontal)
    }

    @Test
    fun verticalEdgesAreReportedIndependently() {
        val top = RemoteCursorMath.move(
            x = 150f, y = 10f, width = 300, height = 200,
            dx = 0, dy = -1, step = 30f, margin = 10f
        )
        assertEquals(-1, top.vertical)
        assertEquals(0, top.horizontal)

        val bottom = RemoteCursorMath.move(
            x = 150f, y = 190f, width = 300, height = 200,
            dx = 0, dy = 1, step = 30f, margin = 10f
        )
        assertEquals(1, bottom.vertical)
    }

    @Test
    fun zeroSizedViewportDoesNotMoveCursor() {
        val result = RemoteCursorMath.move(
            x = 12f, y = 15f, width = 0, height = 0,
            dx = 1, dy = 1, step = 40f, margin = 10f
        )
        assertEquals(12f, result.x, 0.001f)
        assertEquals(15f, result.y, 0.001f)
        assertEquals(0, result.horizontal)
        assertEquals(0, result.vertical)
    }
}
