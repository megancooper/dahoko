package com.dahoko.android.sync

import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** Port of the desktop sync HTTP client (sync/api.ts). */

class SyncApiException(
    message: String,
    val status: Int = 0,
    val remote: RemoteSyncState? = null,
) : Exception(message)

data class SyncAuthResponse(val token: String, val encryptionSalt: String)

data class RemoteSyncState(val revision: Long, val blob: EncryptedSyncBlob?)

/** Reduced view of the server's Stripe subscription cache. */
data class BillingSubscription(
    val status: String,
    val currentPeriodEnd: Long?,
    val cancelAtPeriodEnd: Boolean,
    val cardBrand: String?,
    val cardLast4: String?,
) {
    val active: Boolean get() = status == "active" || status == "trialing"
}

data class BillingState(
    val subscription: BillingSubscription,
    val syncRequiresSubscription: Boolean,
)

private val json = Json { ignoreUnknownKeys = true }
private val JSON_MEDIA = "application/json".toMediaType()

class SyncApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private fun execute(request: Request): Pair<Int, JsonObject> {
        val response = try {
            client.newCall(request).execute()
        } catch (error: IOException) {
            throw SyncApiException("The sync server could not be reached.")
        }
        response.use {
            val text = it.body?.string() ?: ""
            val value = if (text.isBlank()) {
                JsonObject(emptyMap())
            } else {
                try {
                    json.parseToJsonElement(text).jsonObject
                } catch (error: Exception) {
                    throw SyncApiException("The sync server returned an invalid response.", it.code)
                }
            }
            return it.code to value
        }
    }

    private fun errorMessage(value: JsonObject, fallback: String): String {
        val message = (value["error"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        return if (message != null && message.length <= 240) message else fallback
    }

    private fun parseAuth(value: JsonObject): SyncAuthResponse {
        val token = (value["token"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        val salt = (value["encryptionSalt"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        if (token == null || token.length < 32 || token.length > 256 ||
            salt == null || salt.length < 40 || salt.length > 64
        ) {
            throw SyncApiException("The sync server returned invalid account details.")
        }
        return SyncAuthResponse(token, salt)
    }

    private fun parseRemote(value: JsonObject): RemoteSyncState {
        val revision = value["revision"]?.jsonPrimitive?.longOrNull
        if (revision == null || revision < 0) {
            throw SyncApiException("The sync server returned an invalid revision.")
        }
        val blobElement = value["blob"]
        val blob = if (blobElement == null || blobElement is JsonNull) {
            null
        } else {
            validateEncryptedSyncBlob(json.decodeFromJsonElement(EncryptedSyncBlob.serializer(), blobElement))
        }
        return RemoteSyncState(revision, blob)
    }

    fun authenticate(
        serverUrl: String,
        mode: String,
        email: String,
        password: String,
    ): SyncAuthResponse {
        val body = buildJsonObject {
            put("email", email)
            put("password", password)
        }
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/auth/$mode")
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .build(),
        )
        if (code !in 200..299) {
            throw SyncApiException(errorMessage(value, "The account could not be authenticated."), code)
        }
        return parseAuth(value)
    }

    fun getRemoteState(serverUrl: String, token: String): RemoteSyncState {
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/sync")
                .header("Authorization", "Bearer $token")
                .get()
                .build(),
        )
        if (code !in 200..299) {
            throw SyncApiException(errorMessage(value, "Encrypted sync data could not be downloaded."), code)
        }
        return parseRemote(value)
    }

    fun putRemoteState(
        serverUrl: String,
        token: String,
        baseRevision: Long,
        blob: EncryptedSyncBlob,
    ): RemoteSyncState {
        val body = buildJsonObject {
            put("baseRevision", baseRevision)
            put("blob", json.encodeToJsonElement(EncryptedSyncBlob.serializer(), blob))
        }
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/sync")
                .header("Authorization", "Bearer $token")
                .put(body.toString().toRequestBody(JSON_MEDIA))
                .build(),
        )
        if (code == 409) {
            throw SyncApiException(
                "Another device synced first; merging its changes.",
                409,
                parseRemote(value),
            )
        }
        if (code !in 200..299) {
            throw SyncApiException(errorMessage(value, "Encrypted sync data could not be uploaded."), code)
        }
        return parseRemote(value)
    }

    private fun parseSubscription(value: JsonObject?): BillingSubscription {
        val status = (value?.get("status") as? kotlinx.serialization.json.JsonPrimitive)?.content
            ?: return BillingSubscription("none", null, false, null, null)
        val paymentMethod = value["paymentMethod"] as? JsonObject
        return BillingSubscription(
            status = status,
            currentPeriodEnd = value["currentPeriodEnd"]?.jsonPrimitive?.longOrNull,
            cancelAtPeriodEnd =
                (value["cancelAtPeriodEnd"] as? kotlinx.serialization.json.JsonPrimitive)
                    ?.content == "true",
            cardBrand = (paymentMethod?.get("brand") as? kotlinx.serialization.json.JsonPrimitive)?.content,
            cardLast4 = (paymentMethod?.get("last4") as? kotlinx.serialization.json.JsonPrimitive)?.content,
        )
    }

    /** Returns null when the server has billing disabled (self-hosted). */
    fun getBilling(serverUrl: String, token: String): BillingState? {
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/billing")
                .header("Authorization", "Bearer $token")
                .get()
                .build(),
        )
        if (code == 404) return null
        if (code !in 200..299) {
            throw SyncApiException(errorMessage(value, "The plan details could not be loaded."), code)
        }
        return BillingState(
            subscription = parseSubscription(value["subscription"] as? JsonObject),
            syncRequiresSubscription =
                (value["syncRequiresSubscription"] as? kotlinx.serialization.json.JsonPrimitive)
                    ?.content == "true",
        )
    }

    /** Eager post-checkout re-sync of plan state from Stripe. */
    fun refreshBilling(serverUrl: String, token: String): BillingSubscription {
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/billing/sync")
                .header("Authorization", "Bearer $token")
                .post("{}".toRequestBody(JSON_MEDIA))
                .build(),
        )
        if (code !in 200..299) {
            throw SyncApiException(errorMessage(value, "The plan details could not be refreshed."), code)
        }
        return parseSubscription(value["subscription"] as? JsonObject)
    }

    fun createCheckout(serverUrl: String, token: String, email: String, interval: String): String {
        val body = buildJsonObject {
            put("email", email)
            put("interval", interval)
        }
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/billing/checkout")
                .header("Authorization", "Bearer $token")
                .post(body.toString().toRequestBody(JSON_MEDIA))
                .build(),
        )
        val url = (value["url"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        if (code !in 200..299 || url == null || !url.startsWith("https://")) {
            throw SyncApiException(errorMessage(value, "Checkout could not be started."), code)
        }
        return url
    }

    fun createPortal(serverUrl: String, token: String): String {
        val (code, value) = execute(
            Request.Builder()
                .url("$serverUrl/v1/billing/portal")
                .header("Authorization", "Bearer $token")
                .post("{}".toRequestBody(JSON_MEDIA))
                .build(),
        )
        val url = (value["url"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        if (code !in 200..299 || url == null || !url.startsWith("https://")) {
            throw SyncApiException(errorMessage(value, "The billing portal could not be opened."), code)
        }
        return url
    }

    fun logout(serverUrl: String, token: String) {
        try {
            execute(
                Request.Builder()
                    .url("$serverUrl/v1/auth/logout")
                    .header("Authorization", "Bearer $token")
                    .post("{}".toRequestBody(JSON_MEDIA))
                    .build(),
            )
        } catch (error: SyncApiException) {
            // Local disconnect still succeeds when the server is offline.
        }
    }
}

/**
 * Mirrors the desktop URL policy: HTTPS everywhere, with plain HTTP allowed
 * only for loopback-style development hosts (including the emulator's
 * 10.0.2.2 alias for the host machine).
 */
fun normalizeSyncServerUrl(value: String): String {
    val url = try {
        URI(value.trim())
    } catch (error: Exception) {
        throw SyncApiException("Enter a valid sync server URL.")
    }
    if (url.host.isNullOrEmpty()) throw SyncApiException("Enter a valid sync server URL.")
    if (!url.userInfo.isNullOrEmpty() || !url.query.isNullOrEmpty() || !url.fragment.isNullOrEmpty()) {
        throw SyncApiException("The sync server URL cannot contain credentials or query parameters.")
    }
    val loopback = url.host in setOf("localhost", "127.0.0.1", "[::1]", "10.0.2.2")
    if (url.scheme != "https" && !(url.scheme == "http" && loopback)) {
        throw SyncApiException("Sync requires HTTPS. Plain HTTP is allowed only for development hosts.")
    }
    return url.toString().trimEnd('/')
}
