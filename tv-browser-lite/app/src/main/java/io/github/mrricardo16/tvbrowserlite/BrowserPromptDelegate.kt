package io.github.mrricardo16.tvbrowserlite

import android.app.Activity
import android.app.AlertDialog
import android.widget.EditText
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoSession

/**
 * Handles standard JavaScript dialogs using Android native UI.
 * Unhandled sensitive permission prompts are not automatically granted.
 */
class BrowserPromptDelegate(private val activity: Activity) : GeckoSession.PromptDelegate {
    override fun onAlertPrompt(
        session: GeckoSession, prompt: GeckoSession.PromptDelegate.AlertPrompt
    ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse> {
        val result = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
        AlertDialog.Builder(activity)
            .setTitle(prompt.title ?: "网页提示")
            .setMessage(prompt.message ?: "")
            .setPositiveButton("确定") { _, _ -> result.complete(prompt.dismiss()) }
            .setOnCancelListener { result.complete(prompt.dismiss()) }
            .show()
        return result
    }

    override fun onButtonPrompt(
        session: GeckoSession, prompt: GeckoSession.PromptDelegate.ButtonPrompt
    ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse> {
        val result = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
        AlertDialog.Builder(activity)
            .setTitle(prompt.title ?: "网页确认")
            .setMessage(prompt.message ?: "")
            .setPositiveButton("确定") { _, _ ->
                result.complete(prompt.confirm(GeckoSession.PromptDelegate.ButtonPrompt.Type.POSITIVE))
            }
            .setNegativeButton("取消") { _, _ ->
                result.complete(prompt.confirm(GeckoSession.PromptDelegate.ButtonPrompt.Type.NEGATIVE))
            }
            .setOnCancelListener { result.complete(prompt.dismiss()) }
            .show()
        return result
    }

    override fun onTextPrompt(
        session: GeckoSession, prompt: GeckoSession.PromptDelegate.TextPrompt
    ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse> {
        val result = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
        val input = EditText(activity).apply {
            setSingleLine(true)
            setText(prompt.defaultValue ?: "")
        }
        AlertDialog.Builder(activity)
            .setTitle(prompt.title ?: "网页输入")
            .setMessage(prompt.message ?: "")
            .setView(input)
            .setPositiveButton("确定") { _, _ ->
                result.complete(prompt.confirm(input.text.toString()))
            }
            .setNegativeButton("取消") { _, _ -> result.complete(prompt.dismiss()) }
            .setOnCancelListener { result.complete(prompt.dismiss()) }
            .show()
        return result
    }
}
