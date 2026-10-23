package box.stage.share

import android.os.CancellationSignal
import java.io.InputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

internal class ShareCancellation {
  val signal = CancellationSignal()
  private val state = AtomicInteger(0)
  private val input = AtomicReference<InputStream?>(null)
  @Volatile var onCancel: (() -> Unit)? = null
  val isCancelled: Boolean get() = state.get() == 1

  fun complete(): Boolean = state.compareAndSet(0, 2)

  fun attach(source: InputStream) {
    input.set(source)
    if (isCancelled) {
      closeInput()
      throw ShareImportFailure("cancelled")
    }
  }

  fun detach() { input.set(null) }

  fun cancel() {
    if (!state.compareAndSet(0, 1)) return
    try { onCancel?.invoke() } finally {
      signals.execute { try { signal.cancel() } catch (_: Exception) { Unit } }
      streams.execute { closeInput() }
    }
  }

  private fun closeInput() {
    try { input.getAndSet(null)?.close() } catch (_: Exception) { Unit }
  }

  companion object {
    private fun pool() = ThreadPoolExecutor(3, 3, 0, TimeUnit.SECONDS, ArrayBlockingQueue(3), ThreadPoolExecutor.DiscardPolicy())
    private val signals = pool()
    private val streams = pool()
  }
}
