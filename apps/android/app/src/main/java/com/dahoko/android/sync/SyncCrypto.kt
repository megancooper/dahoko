package com.dahoko.android.sync

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.json.Json

/**
 * Port of the desktop sync crypto (sync/crypto.ts). Wire-compatible:
 * PBKDF2-HMAC-SHA-256 (600k iterations) over the passphrase with the
 * server-issued 32-byte salt, then AES-256-GCM with a fresh 96-bit nonce and
 * account-specific AAD of "<iterations>\u0000<saltBase64>".
 */

const val SYNC_KDF_ITERATIONS = 600_000
const val MAX_ENCRYPTED_SYNC_BYTES = 14 * 1024 * 1024

class SyncCryptoException(message: String) : Exception(message)

@kotlinx.serialization.Serializable
data class EncryptedSyncBlob(
    val version: Int,
    val algorithm: String,
    val kdf: String,
    val iterations: Int,
    val salt: String,
    val nonce: String,
    val ciphertext: String,
)

// encodeDefaults keeps format/version markers and empty record maps in the
// JSON — the desktop parser requires every field to be present.
private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}
private val base64 = Base64.getEncoder()
private val base64Decoder = Base64.getDecoder()
private val secureRandom = SecureRandom()

private fun decodeBase64(value: String, label: String): ByteArray {
    if (value.isEmpty() || !Regex("^[A-Za-z0-9+/]+={0,2}$").matches(value)) {
        throw SyncCryptoException("$label is invalid.")
    }
    return try {
        base64Decoder.decode(value)
    } catch (error: IllegalArgumentException) {
        throw SyncCryptoException("$label is invalid.")
    }
}

fun validateEncryptedSyncBlob(blob: EncryptedSyncBlob): EncryptedSyncBlob {
    if (blob.version != 1 || blob.algorithm != "AES-256-GCM" ||
        blob.kdf != "PBKDF2-SHA256" || blob.iterations != SYNC_KDF_ITERATIONS
    ) {
        throw SyncCryptoException("The server returned an unsupported encrypted blob.")
    }
    val salt = decodeBase64(blob.salt, "Encryption salt")
    val nonce = decodeBase64(blob.nonce, "Encryption nonce")
    val ciphertext = decodeBase64(blob.ciphertext, "Encrypted data")
    if (salt.size != 32 || nonce.size != 12) {
        throw SyncCryptoException("The server returned invalid encryption parameters.")
    }
    if (ciphertext.size < 16 || ciphertext.size > MAX_ENCRYPTED_SYNC_BYTES) {
        throw SyncCryptoException("The encrypted sync data has an invalid size.")
    }
    return blob
}

/** Derives the AES-256-GCM key. Slow by design — call off the main thread. */
fun deriveSyncKey(passphrase: String, saltBase64: String): ByteArray {
    val salt = decodeBase64(saltBase64, "Encryption salt")
    if (salt.size != 32) throw SyncCryptoException("The encryption salt is invalid.")
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val spec = PBEKeySpec(passphrase.toCharArray(), salt, SYNC_KDF_ITERATIONS, 256)
    return factory.generateSecret(spec).encoded
}

private fun additionalData(saltBase64: String): ByteArray =
    "$SYNC_KDF_ITERATIONS\u0000$saltBase64".toByteArray(Charsets.UTF_8)

fun encryptSyncDocument(
    document: SyncBundleDocument,
    key: ByteArray,
    saltBase64: String,
): EncryptedSyncBlob {
    val plaintext = json.encodeToString(SyncBundleDocument.serializer(), document)
        .toByteArray(Charsets.UTF_8)
    if (plaintext.size > MAX_ENCRYPTED_SYNC_BYTES - 16) {
        throw SyncCryptoException("There is too much data for one sync account.")
    }
    val nonce = ByteArray(12).also { secureRandom.nextBytes(it) }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
    cipher.updateAAD(additionalData(saltBase64))
    val ciphertext = cipher.doFinal(plaintext)
    return EncryptedSyncBlob(
        version = 1,
        algorithm = "AES-256-GCM",
        kdf = "PBKDF2-SHA256",
        iterations = SYNC_KDF_ITERATIONS,
        salt = saltBase64,
        nonce = base64.encodeToString(nonce),
        ciphertext = base64.encodeToString(ciphertext),
    )
}

fun decryptSyncDocument(
    blob: EncryptedSyncBlob,
    key: ByteArray,
    expectedSalt: String,
): SyncBundleDocument {
    validateEncryptedSyncBlob(blob)
    if (blob.salt != expectedSalt) {
        throw SyncCryptoException("The encrypted data belongs to another account.")
    }
    val nonce = decodeBase64(blob.nonce, "Encryption nonce")
    val ciphertext = decodeBase64(blob.ciphertext, "Encrypted data")
    val plaintext = try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
        cipher.updateAAD(additionalData(blob.salt))
        cipher.doFinal(ciphertext)
    } catch (error: Exception) {
        throw SyncCryptoException(
            "The encryption passphrase is incorrect or the sync data was damaged.",
        )
    }
    return try {
        val document = json.decodeFromString(
            SyncBundleDocument.serializer(),
            plaintext.toString(Charsets.UTF_8),
        )
        if (document.format != SYNC_BUNDLE_FORMAT || document.version != SYNC_BUNDLE_VERSION) {
            throw SyncCryptoException("Encrypted sync data uses an unsupported workspace format.")
        }
        if (document.workspaces.isEmpty()) {
            throw SyncCryptoException("Encrypted sync data has no workspaces.")
        }
        document
    } catch (error: SyncCryptoException) {
        throw error
    } catch (error: Exception) {
        throw SyncCryptoException("The encrypted sync data could not be parsed.")
    }
}
