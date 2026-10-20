package io.github.mrricardo16.tvbrowserlite

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class UrlNormalizerTest {
    @Test fun lanIpWithPort() =
        assertEquals("http://192.168.12.195:8221/", UrlNormalizer.normalize("192.168.12.195:8221"))

    @Test fun hashRouterIsPreserved() =
        assertEquals(
            "http://192.168.12.195:8221/#/login",
            UrlNormalizer.normalize("192.168.12.195:8221/#/login")
        )

    @Test fun explicitHttpIsNeverPromotedToHttps() =
        assertEquals(
            "http://192.168.12.195:8221/api?q=1#top",
            UrlNormalizer.normalize("http://192.168.12.195:8221/api?q=1#top")
        )

    @Test fun publicHostDefaultsToHttps() =
        assertEquals("https://www.baidu.com/", UrlNormalizer.normalize("www.baidu.com"))

    @Test fun localhostDefaultsToHttp() =
        assertEquals("http://localhost:3000/", UrlNormalizer.normalize("localhost:3000"))

    @Test fun unsupportedSchemeRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            UrlNormalizer.normalize("file:///etc/passwd")
        }
    }

    @Test fun embeddedCredentialsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            UrlNormalizer.normalize("https://user:pass@example.com/")
        }
    }

    @Test fun emptyInputRejected() {
        assertThrows(IllegalArgumentException::class.java) { UrlNormalizer.normalize("   ") }
    }
}
