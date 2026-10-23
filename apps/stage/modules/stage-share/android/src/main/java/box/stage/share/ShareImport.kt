package box.stage.share

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.OpenableColumns
import java.io.File
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal class ShareImportFailure(val code: String) : Exception()

internal object ShareImport {
  const val MAX_FILES = 10
  const val MAX_FILE_BYTES = 25L * 1024 * 1024
  const val MAX_TOTAL_BYTES = 50L * 1024 * 1024
  private const val MAX_CACHE_BYTES = 200L * 1024 * 1024
  private val timer = Executors.newSingleThreadScheduledExecutor()
  private val filesLock = Any()
  private var initialized = false

  fun root(context: Context) = File(context.cacheDir, "stage-shares")

  fun initialize(context: Context) = synchronized(filesLock) {
    if (!initialized) {
      root(context).deleteRecursively()
      initialized = true
    }
  }

  fun remove(directory: File) = synchronized(filesLock) { directory.deleteRecursively() }

  fun read(context: Context, intent: Intent, id: String, cancellation: ShareCancellation): Map<String, Any> {
    val uris = streamUris(intent)
    if (uris.isEmpty()) throw ShareImportFailure("unsupported")
    val directory = File(root(context), id)
    if (!directory.mkdirs()) throw ShareImportFailure("read")
    try {
      var remaining = MAX_TOTAL_BYTES
      val files = uris.mapIndexed { index, uri ->
        if (cancellation.isCancelled) throw ShareImportFailure("cancelled")
        validateUri(context, uri)
        val file = copy(context, uri, File(directory, "$index"), remaining, cancellation)
        remaining -= file["size"] as Long
        file
      }
      return mapOf("files" to files)
    } catch (error: Exception) {
      remove(directory)
      throw error
    }
  }

  private fun streamUris(intent: Intent): List<Uri> {
    val streams = if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else legacyMultiple(intent)
    } else {
      val stream = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else legacySingle(intent)
      stream?.let { listOf(it) }
    }
    val clip = intent.clipData
    val count = streams?.size ?: clip?.itemCount ?: 0
    if (count > MAX_FILES) throw ShareImportFailure("count")
    val values = streams ?: (0 until count).map { clip?.getItemAt(it)?.uri ?: throw ShareImportFailure("unsupported") }
    return values.distinct()
  }

  @Suppress("DEPRECATION")
  private fun legacySingle(intent: Intent): Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)

  @Suppress("DEPRECATION")
  private fun legacyMultiple(intent: Intent): ArrayList<Uri>? = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)

  private fun validateUri(context: Context, uri: Uri) {
    val authority = uri.authority?.substringAfterLast('@') ?: throw ShareImportFailure("unsupported")
    if (uri.scheme != "content" || authority.startsWith(context.packageName)) throw ShareImportFailure("unsupported")
    val provider = context.packageManager.resolveContentProvider(authority, 0)
    if (provider?.applicationInfo?.uid == Process.myUid()) throw ShareImportFailure("unsupported")
    val permission = context.checkUriPermission(uri, Process.myPid(), Process.myUid(), Intent.FLAG_GRANT_READ_URI_PERMISSION)
    if (permission != PackageManager.PERMISSION_GRANTED) throw ShareImportFailure("read")
  }

  private fun copy(context: Context, uri: Uri, target: File, remaining: Long, cancellation: ShareCancellation): Map<String, Any> {
    val signal = cancellation.signal
    val timeout = timer.schedule({ cancellation.cancel() }, 60, TimeUnit.SECONDS)
    try {
      val resolver = context.contentResolver
      val name = metadataName(context, uri, remaining, cancellation)
      val mime = mimeType(context, uri)
      val descriptor = resolver.openAssetFileDescriptor(uri, "r", signal) ?: throw ShareImportFailure("read")
      val size = descriptor.use {
        checkSize(it.length, remaining)
        it.createInputStream().use { source ->
          cancellation.attach(source)
          copyBytes(source, target, remaining, cancellation)
        }
      }
      if (size == 0L) throw ShareImportFailure("empty")
      return mapOf("uri" to Uri.fromFile(target).toString(), "name" to name, "mimeType" to mime, "size" to size)
    } finally {
      timeout.cancel(false)
      cancellation.detach()
    }
  }

  private fun metadataName(context: Context, uri: Uri, remaining: Long, cancellation: ShareCancellation): String {
    var name = "Shared file"
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null, cancellation.signal)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (nameIndex >= 0) name = safeName(cursor.getString(nameIndex) ?: name)
          val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) checkSize(cursor.getLong(sizeIndex), remaining)
        }
      }
    } catch (_: UnsupportedOperationException) { Unit }
      catch (_: IllegalArgumentException) { Unit }
    return name
  }

  private fun mimeType(context: Context, uri: Uri): String {
    val type = try { context.contentResolver.getType(uri) }
      catch (_: UnsupportedOperationException) { null }
      catch (_: IllegalArgumentException) { null }
    return type?.takeIf { it.length <= 127 && it.matches(Regex("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+")) }
      ?: "application/octet-stream"
  }

  private fun copyBytes(input: InputStream, target: File, remaining: Long, cancellation: ShareCancellation): Long {
    var size = 0L
    target.outputStream().use { output ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        if (cancellation.isCancelled) throw ShareImportFailure("cancelled")
        val count = input.read(buffer)
        if (count < 0) break
        size += count
        checkSize(size, remaining)
        synchronized(filesLock) {
          if (cancellation.isCancelled) throw ShareImportFailure("cancelled")
          val cacheSize = target.parentFile?.parentFile?.walkTopDown()?.filter { it.isFile }?.sumOf { it.length() } ?: MAX_CACHE_BYTES
          if (cacheSize + count > MAX_CACHE_BYTES) throw ShareImportFailure("storage")
          output.write(buffer, 0, count)
        }
      }
    }
    return size
  }

  private fun checkSize(size: Long, remaining: Long) {
    if (size > MAX_FILE_BYTES || size > remaining) throw ShareImportFailure("size")
  }

  private fun safeName(name: String): String {
    return name.substringAfterLast('/').substringAfterLast('\\')
      .filter { !it.isISOControl() }.take(160).ifBlank { "Shared file" }
  }
}
