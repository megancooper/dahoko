package com.dahoko.android

import android.app.Application
import androidx.room.Room
import com.dahoko.android.data.DahokoDb
import com.dahoko.android.data.Repository
import com.dahoko.android.sync.SyncStore

class DahokoApp : Application() {
    lateinit var repository: Repository
        private set
    lateinit var syncStore: SyncStore
        private set

    override fun onCreate() {
        super.onCreate()
        val db = Room.databaseBuilder(this, DahokoDb::class.java, "dahoko.db").build()
        repository = Repository(db)
        syncStore = SyncStore(this)
    }
}
