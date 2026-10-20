plugins {
    id("com.android.application") version "9.1.1" apply false
    // AGP built-in Kotlin uses this classpath compiler version, but do not apply kotlin-android.
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
}
