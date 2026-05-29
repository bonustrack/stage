package box.metro.pill

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * The draggable circular "chat-head" pill rendered via WindowManager as a
 * TYPE_APPLICATION_OVERLAY window. Distinguishes a tap (→ onTap) from a drag
 * by a movement threshold. Persists its last position in SharedPreferences so
 * it reappears where the user left it.
 */
class OverlayView(
  private val context: Context,
  private val onTap: () -> Unit,
) {
  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: FrameLayout? = null
  private lateinit var params: WindowManager.LayoutParams
  private var label: TextView? = null

  private val prefs = context.getSharedPreferences("metro_pill", Context.MODE_PRIVATE)

  fun attach() {
    val size = dp(56)
    val view = FrameLayout(context)
    val bg = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      // Teal — the user's favourite colour.
      setColor(Color.parseColor("#14b8a6"))
    }
    view.background = bg

    val tv = TextView(context).apply {
      text = "🎤" // microphone emoji
      textSize = 22f
      setTextColor(Color.WHITE)
    }
    val lp = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply { gravity = Gravity.CENTER }
    view.addView(tv, lp)
    label = tv

    val type = if (Build.VERSION.SDK_INT >= 26)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    params = WindowManager.LayoutParams(
      size, size, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = prefs.getInt("x", dp(16))
      y = prefs.getInt("y", dp(120))
    }

    view.setOnTouchListener(makeTouchListener())
    root = view
    wm.addView(view, params)
  }

  fun setRecording(recording: Boolean) {
    label?.post {
      label?.text = if (recording) "⏹" else "🎤" // stop ⏹ vs mic
      (root?.background as? GradientDrawable)?.setColor(
        if (recording) Color.parseColor("#ef4444") else Color.parseColor("#14b8a6"),
      )
    }
  }

  fun detach() {
    root?.let { try { wm.removeView(it) } catch (_: Throwable) {} }
    root = null
  }

  private fun makeTouchListener(): View.OnTouchListener {
    var initialX = 0
    var initialY = 0
    var touchX = 0f
    var touchY = 0f
    var downTime = 0L
    var moved = false
    val touchSlop = dp(8).toFloat()

    return View.OnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          touchX = event.rawX
          touchY = event.rawY
          downTime = System.currentTimeMillis()
          moved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          if (abs(dx) > touchSlop || abs(dy) > touchSlop) moved = true
          params.x = initialX + dx.toInt()
          params.y = initialY + dy.toInt()
          try { wm.updateViewLayout(root, params) } catch (_: Throwable) {}
          true
        }
        MotionEvent.ACTION_UP -> {
          val dt = System.currentTimeMillis() - downTime
          if (!moved && dt < 350) {
            onTap()
          } else {
            prefs.edit().putInt("x", params.x).putInt("y", params.y).apply()
          }
          true
        }
        else -> false
      }
    }
  }

  private fun dp(v: Int): Int =
    (v * context.resources.displayMetrics.density).toInt()
}
