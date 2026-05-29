package box.metro.pill

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.hypot

/**
 * The draggable circular "chat-head" pill rendered via WindowManager as a
 * TYPE_APPLICATION_OVERLAY window.
 *
 * Interaction model (user-specified):
 *  - PRESS-AND-HOLD (> [HOLD_MS]) → push-to-talk: starts recording, the pill
 *    grows + turns accent-red + shows a recording dot. RELEASE → stop + send
 *    (onRecordStop with commit=true). While holding, dragging the finger away
 *    past [CANCEL_SLOP] arms slide-to-cancel (pill dims + "✕ release to cancel"
 *    hint); releasing there cancels WITHOUT sending (commit=false).
 *  - SHORT TAP (no hold, no drag) → toggles an expanded bar next to the pill
 *    with a ✕ close button (onClose) and an "open chat" glyph (onOpenChat).
 *  - DRAG (when not recording) → repositions the pill; position persisted.
 *
 * Tap vs hold is disambiguated by a [HOLD_MS] long-press timeout + an initial
 * movement threshold ([TOUCH_SLOP]); a quick tap never records.
 */
class OverlayView(
  private val context: Context,
  private val onRecordStart: () -> Unit,
  private val onRecordStop: (commit: Boolean) -> Unit,
  private val onClose: () -> Unit,
  private val onOpenChat: () -> Unit,
) {
  private val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: FrameLayout? = null
  private var pill: FrameLayout? = null
  private lateinit var params: WindowManager.LayoutParams
  private var label: TextView? = null
  private var hint: TextView? = null
  private var bar: LinearLayout? = null

  private val prefs = context.getSharedPreferences("metro_pill", Context.MODE_PRIVATE)
  private val handler = Handler(Looper.getMainLooper())

  // Gesture state.
  private var holdRunnable: Runnable? = null
  private var isHolding = false      // long-press fired → recording in progress
  private var willCancel = false     // finger dragged past cancel threshold while holding
  private var moved = false          // moved past slop before hold fired → treat as drag
  private var barExpanded = false

  fun attach() {
    val container = FrameLayout(context)

    // ---- the pill itself ----
    val p = FrameLayout(context)
    p.background = pillBg(REST_COLOR)

    val tv = TextView(context).apply {
      text = MIC
      textSize = 22f
      setTextColor(Color.WHITE)
    }
    p.addView(tv, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply { gravity = Gravity.CENTER })
    label = tv
    pill = p

    val pillSize = dp(PILL_DP)
    container.addView(p, FrameLayout.LayoutParams(pillSize, pillSize).apply {
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
    })

    // ---- the slide-to-cancel hint (shown only while recording) ----
    val h = TextView(context).apply {
      text = ""
      textSize = 12f
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(10), dp(6), dp(10), dp(6))
      background = pillRect(Color.parseColor("#cc111111"))
      visibility = View.GONE
    }
    container.addView(h, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
      marginStart = pillSize + dp(8)
    })
    hint = h

    // ---- the expanded action bar (close + open chat); hidden by default ----
    val b = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      background = pillRect(Color.parseColor("#f014b8a6"))
      setPadding(dp(8), dp(4), dp(8), dp(4))
      visibility = View.GONE
    }
    b.addView(actionButton(CHAT) { collapseBar(); onOpenChat() })
    b.addView(actionButton(CLOSE) { onClose() })
    container.addView(b, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
      marginStart = pillSize + dp(8)
    })
    bar = b

    val type = if (Build.VERSION.SDK_INT >= 26)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = prefs.getInt("x", dp(16))
      y = prefs.getInt("y", dp(120))
    }

    // Only the pill drives gestures — the bar's own buttons handle their clicks.
    p.setOnTouchListener(makeTouchListener())
    root = container
    wm.addView(container, params)
  }

  /** Visual state for an in-progress recording (called from the service too as a
   *  safety net). */
  fun setRecording(recording: Boolean) {
    label?.post { renderRecording(recording, cancelArmed = false) }
  }

  fun detach() {
    cancelHoldTimer()
    root?.let { try { wm.removeView(it) } catch (_: Throwable) {} }
    root = null
  }

  // ---- gesture handling ----

  private fun makeTouchListener(): View.OnTouchListener {
    var initialX = 0
    var initialY = 0
    var touchX = 0f
    var touchY = 0f
    val touchSlop = dp(TOUCH_SLOP_DP).toFloat()
    val cancelSlop = dp(CANCEL_SLOP_DP).toFloat()

    return View.OnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          touchX = event.rawX
          touchY = event.rawY
          moved = false
          isHolding = false
          willCancel = false
          // Arm the long-press → push-to-talk start.
          scheduleHold()
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - touchX
          val dy = event.rawY - touchY
          if (isHolding) {
            // Recording: interpret movement as slide-to-cancel, NOT drag.
            val dist = hypot(dx.toDouble(), dy.toDouble()).toFloat()
            val arm = dist > cancelSlop
            if (arm != willCancel) {
              willCancel = arm
              renderRecording(true, cancelArmed = arm)
            }
          } else {
            // Not yet recording: past the slop this is a drag → cancel the hold
            // and reposition the pill.
            if (abs(dx) > touchSlop || abs(dy) > touchSlop) {
              moved = true
              cancelHoldTimer()
            }
            if (moved) {
              params.x = initialX + dx.toInt()
              params.y = initialY + dy.toInt()
              try { wm.updateViewLayout(root, params) } catch (_: Throwable) {}
            }
          }
          true
        }

        MotionEvent.ACTION_UP -> {
          if (isHolding) {
            // Push-to-talk release → stop + (send | cancel).
            val commit = !willCancel
            isHolding = false
            willCancel = false
            renderRecording(false, cancelArmed = false)
            onRecordStop(commit)
          } else {
            cancelHoldTimer()
            if (!moved) {
              // Short tap → toggle the expanded bar.
              toggleBar()
            } else {
              persistPosition()
            }
          }
          true
        }

        MotionEvent.ACTION_CANCEL -> {
          if (isHolding) {
            isHolding = false
            willCancel = false
            renderRecording(false, cancelArmed = false)
            onRecordStop(false) // a system-cancelled gesture must not send
          } else {
            cancelHoldTimer()
          }
          true
        }

        else -> false
      }
    }
  }

  private fun scheduleHold() {
    cancelHoldTimer()
    val r = Runnable {
      if (moved) return@Runnable
      isHolding = true
      // Starting a recording always collapses the action bar.
      collapseBar()
      renderRecording(true, cancelArmed = false)
      onRecordStart()
    }
    holdRunnable = r
    handler.postDelayed(r, HOLD_MS)
  }

  private fun cancelHoldTimer() {
    holdRunnable?.let { handler.removeCallbacks(it) }
    holdRunnable = null
  }

  private fun persistPosition() {
    prefs.edit().putInt("x", params.x).putInt("y", params.y).apply()
  }

  // ---- expanded bar ----

  private fun toggleBar() {
    if (barExpanded) collapseBar() else expandBar()
  }

  private fun expandBar() {
    barExpanded = true
    hint?.visibility = View.GONE
    bar?.visibility = View.VISIBLE
  }

  private fun collapseBar() {
    barExpanded = false
    bar?.visibility = View.GONE
  }

  // ---- visuals ----

  private fun renderRecording(recording: Boolean, cancelArmed: Boolean) {
    val p = pill ?: return
    val tv = label ?: return
    val h = hint
    if (recording) {
      tv.text = if (cancelArmed) CANCEL else DOT
      (p.background as? GradientDrawable)?.setColor(
        if (cancelArmed) CANCEL_COLOR else REC_COLOR,
      )
      p.scaleX = 1.18f
      p.scaleY = 1.18f
      h?.text = if (cancelArmed) "Release to cancel" else "← Slide to cancel"
      h?.background = pillRect(if (cancelArmed) Color.parseColor("#cc7f1d1d") else Color.parseColor("#cc111111"))
      h?.visibility = View.VISIBLE
    } else {
      tv.text = MIC
      (p.background as? GradientDrawable)?.setColor(REST_COLOR)
      p.scaleX = 1f
      p.scaleY = 1f
      h?.visibility = View.GONE
    }
  }

  private fun actionButton(glyph: String, onClick: () -> Unit): TextView {
    return TextView(context).apply {
      text = glyph
      textSize = 20f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      val s = dp(40)
      width = s
      height = s
      isClickable = true
      setOnClickListener { onClick() }
    }
  }

  private fun pillBg(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(color)
  }

  private fun pillRect(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    cornerRadius = dp(20).toFloat()
    setColor(color)
  }

  private fun dp(v: Int): Int =
    (v * context.resources.displayMetrics.density).toInt()

  companion object {
    private const val PILL_DP = 56
    private const val HOLD_MS = 280L          // long-press threshold for push-to-talk
    private const val TOUCH_SLOP_DP = 8       // pre-hold movement → treat as drag
    private const val CANCEL_SLOP_DP = 80     // drag-away distance while holding → cancel

    private val REST_COLOR = Color.parseColor("#14b8a6") // teal
    private val REC_COLOR = Color.parseColor("#ef4444")  // red (recording)
    private val CANCEL_COLOR = Color.parseColor("#7f1d1d") // dark red (will cancel)

    private const val MIC = "🎤"
    private const val DOT = "●"      // recording dot
    private const val CANCEL = "✕"
    private const val CHAT = "💬"
    private const val CLOSE = "✕"
  }
}
