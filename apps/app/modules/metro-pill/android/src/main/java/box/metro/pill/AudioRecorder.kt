package box.metro.pill

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Thin MediaRecorder wrapper producing AAC-in-MPEG4 (.m4a / audio/m4a) — the
 * exact format the composer's expo-av path produces, so received clips render
 * identically in MessengerAudioPlayer.
 *
 * MediaRecorder is fragile: stop() throws if no frames were captured, and
 * start/stop must be ordered. All transitions are guarded defensively.
 */
class AudioRecorder(private val context: Context) {
  data class Result(val uri: String, val durationMs: Long)

  private var recorder: MediaRecorder? = null
  private var outputFile: File? = null
  private var startedAt: Long = 0
  var isRecording: Boolean = false
    private set

  fun start() {
    val file = File(context.cacheDir, "voice-" + System.currentTimeMillis() + ".m4a")
    val rec = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
    rec.setAudioSource(MediaRecorder.AudioSource.MIC)
    rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
    rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
    rec.setAudioEncodingBitRate(64000)
    rec.setAudioSamplingRate(44100)
    rec.setOutputFile(file.absolutePath)
    rec.prepare()
    rec.start()
    recorder = rec
    outputFile = file
    startedAt = System.currentTimeMillis()
    isRecording = true
  }

  /** Stops recording. Returns null if the clip was too short / had no frames
   *  (MediaRecorder threw on stop) — caller treats that as a no-op. */
  fun stop(): Result? {
    val rec = recorder ?: return null
    val file = outputFile
    val duration = System.currentTimeMillis() - startedAt
    isRecording = false
    recorder = null
    outputFile = null
    return try {
      rec.stop()
      rec.release()
      if (file != null && file.exists() && file.length() > 0) {
        Result("file://" + file.absolutePath, duration)
      } else {
        null
      }
    } catch (e: Throwable) {
      // stop-with-no-audio (RuntimeException) — discard the empty file.
      try { rec.release() } catch (_: Throwable) {}
      try { file?.delete() } catch (_: Throwable) {}
      null
    }
  }
}
