package com.dahoko.android.sync

import com.dahoko.android.domain.WorkspaceSnapshot

/** Port of the desktop sync orchestration (sync/engine.ts). */

private const val MAX_CONFLICT_RETRIES = 3

data class SyncCredentials(
    val serverUrl: String,
    val token: String,
    val encryptionSalt: String,
    val key: ByteArray,
    val deviceId: String,
)

data class EncryptedSyncResult(
    val localState: LocalSyncState,
    val snapshots: List<WorkspaceSnapshot>,
    val revision: Long,
    val uploaded: Boolean,
)

/**
 * Build the local document from the database snapshot, merge with the
 * server's decrypted document, and upload with compare-and-swap; on a 409
 * conflict, re-merge against the newer remote revision and retry.
 */
fun runEncryptedSync(
    api: SyncApi,
    credentials: SyncCredentials,
    snapshots: List<WorkspaceSnapshot>,
    previousState: LocalSyncState?,
): EncryptedSyncResult {
    var local = buildLocalSyncBundle(
        snapshots,
        previousState?.document,
        previousState?.clock ?: SyncClock(0, 0),
        credentials.deviceId,
    )
    var remote = api.getRemoteState(credentials.serverUrl, credentials.token)

    for (attempt in 0..MAX_CONFLICT_RETRIES) {
        val remoteDocument = remote.blob?.let {
            decryptSyncDocument(it, credentials.key, credentials.encryptionSalt)
        } ?: emptySyncBundleDocument()
        val observedClock = observeBundleClock(local.clock, remoteDocument)
        val merged = normalizeSyncBundle(
            mergeSyncBundles(local.document, remoteDocument),
            observedClock,
            credentials.deviceId,
        )

        if (remote.blob != null && merged.document == remoteDocument) {
            return EncryptedSyncResult(
                localState = merged,
                snapshots = syncBundleToSnapshots(merged.document),
                revision = remote.revision,
                uploaded = false,
            )
        }

        val encrypted = encryptSyncDocument(
            merged.document,
            credentials.key,
            credentials.encryptionSalt,
        )
        try {
            val saved = api.putRemoteState(
                credentials.serverUrl,
                credentials.token,
                remote.revision,
                encrypted,
            )
            return EncryptedSyncResult(
                localState = merged,
                snapshots = syncBundleToSnapshots(merged.document),
                revision = saved.revision,
                uploaded = true,
            )
        } catch (error: SyncApiException) {
            if (error.status == 409 && error.remote != null && attempt < MAX_CONFLICT_RETRIES) {
                local = merged
                remote = error.remote
                continue
            }
            throw error
        }
    }

    throw SyncApiException("Sync stayed busy on another device. Try again in a moment.", 409)
}
