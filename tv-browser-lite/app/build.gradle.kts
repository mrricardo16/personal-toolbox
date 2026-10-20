plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.mrricardo16.tvbrowserlite"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.mrricardo16.tvbrowserlite"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes { release { isMinifyEnabled = false } }
    packaging {
        resources.excludes += setOf("META-INF/DEPENDENCIES", "META-INF/NOTICE", "META-INF/LICENSE")
    }
}

dependencies {
    implementation("org.mozilla.geckoview:geckoview-omni:157.0.20261005135250")
    testImplementation("junit:junit:4.13.2")
}
