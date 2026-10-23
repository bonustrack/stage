package box.stage.share

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

internal object StageShareInbox {
  private data class Entry(val id: String, var status: String = "loading", var payload: Map<String, Any> = emptyMap()) {
    val cancellation = ShareCancellation()
  }

  private val entries = mutableListOf<Entry>()
  private var imports = 0
  private val workers = Executors.newFixedThreadPool(3)
  private val cleanup = Executors.newSingleThreadExecutor()
  @Volatile var changed: (() -> Unit)? = null

  private fun isShare(intent: Intent) = intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE

  private fun consume(intent: Intent) {
    intent.action = Intent.ACTION_MAIN
    intent.replaceExtras(Bundle())
    intent.setDataAndType(null, null)
    intent.clipData = null
  }

  fun restore(intent: Intent) {
    if (!isShare(intent)) return
    consume(intent)
    synchronized(entries) {
      if (entries.isEmpty()) entries.add(Entry(UUID.randomUUID().toString(), "error", mapOf("error" to "interrupted")))
    }
    changed?.invoke()
  }

  fun receive(context: Context, intent: Intent) {
    if (!isShare(intent)) return
    val snapshot = Intent(intent)
    consume(intent)
    val entry = synchronized(entries) {
      if (entries.size >= 3 || imports >= 3) null else Entry(UUID.randomUUID().toString()).also { entries.add(it); imports += 1 }
    }
    if (entry == null) {
      Toast.makeText(context, "Finish the pending shares, then share this item again.", Toast.LENGTH_LONG).show()
      return
    }
    val application = context.applicationContext
    entry.cancellation.onCancel = {
      synchronized(entries) {
        entry.payload = mapOf("error" to "read")
        entry.status = "error"
      }
      removeFiles(application, entry)
      changed?.invoke()
    }
    changed?.invoke()
    workers.execute { importShare(application, snapshot, entry) }
  }

  private fun importShare(context: Context, snapshot: Intent, entry: Entry) {
    try {
      ShareImport.initialize(context)
      if (entry.cancellation.isCancelled) return
      val payload = ShareImport.read(context, snapshot, entry.id, entry.cancellation)
      synchronized(entries) {
        if (!entry.cancellation.complete()) throw ShareImportFailure("cancelled")
        entry.payload = payload
        entry.status = "ready"
      }
    } catch (error: Exception) {
      synchronized(entries) {
        entry.payload = mapOf("error" to if (error is ShareImportFailure) error.code else "read")
        entry.status = "error"
      }
    } finally {
      if (entry.cancellation.isCancelled || entry.status != "ready") removeFiles(context, entry)
      synchronized(entries) { imports -= 1 }
      changed?.invoke()
    }
  }

  private fun removeFiles(context: Context, entry: Entry) {
    cleanup.execute { ShareImport.remove(File(ShareImport.root(context), entry.id)) }
  }

  fun pending(): Map<String, Any>? = synchronized(entries) {
    entries.firstOrNull()?.let { mapOf("id" to it.id, "status" to it.status) + it.payload }
  }

  fun dismiss(context: Context, id: String, keepFiles: Boolean) {
    val entry = synchronized(entries) {
      entries.firstOrNull { it.id == id }?.also { entries.remove(it) }
    } ?: return
    if (!keepFiles) entry.cancellation.cancel()
    removeFiles(context, entry)
    changed?.invoke()
  }
}
