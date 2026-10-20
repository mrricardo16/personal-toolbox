package io.github.mrricardo16.tvbrowserlite

import java.net.URI

/** Strict address-bar navigation. No keyword search or implicit HTTP -> HTTPS upgrade. */
object UrlNormalizer {
    fun normalize(raw: String): String {
        val text = raw.trim()
        require(text.isNotEmpty()) { "请输入网址" }
        require(!text.any { it.isWhitespace() || it.code < 32 }) { "网址包含空格或控制字符" }

        val hasScheme = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(text)
        val firstHost = text.substringBefore('/').substringBefore('?').substringBefore('#')
        val isLocal = firstHost.equals("localhost", ignoreCase = true) ||
            firstHost.startsWith("localhost:", ignoreCase = true) ||
            firstHost.startsWith('[') || firstHost.endsWith(".local", ignoreCase = true) ||
            Regex("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}(?::[0-9]+)?$").matches(firstHost)
        val candidate = if (hasScheme) text else (if (isLocal) "http://" else "https://") + text

        val parsed = try { URI(candidate) } catch (_: Exception) {
            throw IllegalArgumentException("网址格式不正确")
        }
        require(parsed.scheme.equals("http", true) || parsed.scheme.equals("https", true)) {
            "只允许 http:// 和 https://"
        }
        require(!parsed.host.isNullOrEmpty() && parsed.rawUserInfo == null) {
            "网址主机无效或不允许包含用户名密码"
        }
        require(parsed.port in -1..65535) { "端口必须介于 1–65535" }
        val authority = parsed.rawAuthority ?: throw IllegalArgumentException("网址主机无效")
        if (authority.endsWith(":")) throw IllegalArgumentException("端口不能为空")
        val url = parsed.toASCIIString()
        return if (parsed.rawPath.isNullOrEmpty()) {
            // Preserve query/hash while ensuring a consistent path.
            parsed.scheme + "://" + parsed.rawAuthority + "/" +
                (parsed.rawQuery?.let { "?$it" } ?: "") +
                (parsed.rawFragment?.let { "#$it" } ?: "")
        } else url
    }
}
