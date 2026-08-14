package com.dahoko.android

import android.app.Application
import android.util.Log
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

/**
 * PostHog error tracking + logs. Inactive when the build carries no token
 * (see buildConfigField in app/build.gradle.kts), so local and self-built
 * APKs never phone home.
 */
object Telemetry {
    @Volatile
    var active: Boolean = false
        private set

    fun setup(app: Application) {
        val token = BuildConfig.POSTHOG_PROJECT_TOKEN
        if (token.isBlank()) return
        val config = PostHogAndroidConfig(
            apiKey = token,
            host = BuildConfig.POSTHOG_HOST,
        ).apply {
            captureApplicationLifecycleEvents = true
            // Single-activity Compose app; screen names would all be MainActivity.
            captureScreenViews = false
            errorTrackingConfig.autoCapture = true
            logs.serviceName = "dahoko-android"
            logs.environment = if (BuildConfig.DEBUG) "development" else "production"
            logs.serviceVersion = BuildConfig.VERSION_NAME
        }
        PostHogAndroid.setup(app, config)
        active = true
    }
}

/**
 * Structured logger: always mirrors to logcat; when telemetry is active,
 * info+ ships to PostHog Logs (tagged with distinct id and session) and
 * errors carrying a Throwable are reported to error tracking too.
 */
object AppLog {
    fun d(tag: String, message: String) {
        Log.d(tag, message)
    }

    fun i(tag: String, message: String, attrs: Map<String, Any> = emptyMap()) {
        Log.i(tag, message)
        if (Telemetry.active) PostHog.logger.info(message, attrs + ("tag" to tag))
    }

    fun w(tag: String, message: String, attrs: Map<String, Any> = emptyMap()) {
        Log.w(tag, message)
        if (Telemetry.active) PostHog.logger.warn(message, attrs + ("tag" to tag))
    }

    fun e(
        tag: String,
        message: String,
        error: Throwable? = null,
        attrs: Map<String, Any> = emptyMap(),
    ) {
        Log.e(tag, message, error)
        if (!Telemetry.active) return
        val logAttrs = attrs + buildMap {
            put("tag", tag)
            error?.let {
                put("errorType", it.javaClass.simpleName)
                put("errorMessage", it.message ?: "")
            }
        }
        PostHog.logger.error(message, logAttrs)
        if (error != null) {
            PostHog.captureException(
                error,
                attrs + mapOf("log_tag" to tag, "log_message" to message),
            )
        }
    }
}
