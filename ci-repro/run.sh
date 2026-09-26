#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${GITHUB_WORKSPACE:-$ROOT}/repro-out"
mkdir -p "$OUT"
PKG=box.metro.monitor
DEEP="stage://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081&disableOnboarding=1"
VARIANTS="${VARIANTS:-v0-main v1-android-no-stack-swipe v2-one-column-no-overflow}"
log() { echo "[$(date +%T)] $*"; }

dump_ui() {
  local step="$1" xml=""
  for _ in 1 2 3; do
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && xml="$(adb exec-out cat /sdcard/ui.xml 2>/dev/null)" && [ -n "$xml" ] && break
    sleep 1
  done
  printf '%s' "$xml" > "$OUT/$step.xml"
  printf '%s' "$xml" | python3 "$ROOT/ci-repro/ui.py" "$step"
}

shot() {
  adb exec-out screencap -p > "$OUT/$1.png"
  dump_ui "$1"
}

ui_field() { python3 -c "import json,sys; d=json.loads(sys.stdin.read()[3:]); v=d.get('$1'); print('' if v is None else (' '.join(map(str,v)) if isinstance(v,list) else v))"; }

launch_board() {
  local tag="$1" line on tap
  adb shell am force-stop "$PKG"
  adb logcat -c
  adb shell am start -a android.intent.action.VIEW -d "$DEEP" "$PKG" >/dev/null
  for i in $(seq 1 60); do
    sleep 5
    line="$(dump_ui "$tag-wait")"
    on="$(printf '%s' "$line" | ui_field onBoard)"
    if [ "$on" = "True" ]; then
      sleep 2
      log "$tag on board after $((i * 5))s"
      return 0
    fi
    tap="$(printf '%s' "$line" | ui_field tap)"
    if [ -n "$tap" ]; then adb shell input tap $tap; fi
    if [ $((i % 6)) -eq 0 ]; then
      log "$tag waiting: $line"
      adb exec-out screencap -p > "$OUT/$tag-wait-$i.png"
    fi
  done
  log "$tag never reached the board"
  adb exec-out screencap -p > "$OUT/$tag-noboard.png"
  return 1
}

swipe() { adb shell input touchscreen swipe "$1" "$2" "$3" "$2" "${4:-300}"; sleep 1.5; }

hold_drag() {
  local x1="$1" y="$2" x2="$3" name="$4" step x
  adb shell input motionevent DOWN "$x1" "$y" || return 1
  for step in 1 2 3 4 5 6 7 8; do
    x=$(( x1 + (x2 - x1) * step / 8 ))
    adb shell input motionevent MOVE "$x" "$y"
  done
  adb exec-out screencap -p > "$OUT/$name-held.png"
  log "$name held screenshot taken"
  adb shell input motionevent UP "$x2" "$y"
  sleep 1.5
}

run_case() {
  local v="$1" c="$2"
  local tag="$v-$c"
  launch_board "$tag" || { adb logcat -d > "$OUT/$tag-logcat.txt"; return; }
  shot "$tag-0-before"
  case "$c" in
    rtl-card) swipe "$XR" "$YC" "$XL"; shot "$tag-1-after" ;;
    rtl-empty) swipe "$XR" "$YE" "$XL"; shot "$tag-1-after" ;;
    ltr-card-scrolled) swipe "$XR" "$YC" "$XL"; shot "$tag-1-scrolled"; swipe "$XL" "$YC" "$XR"; shot "$tag-2-after" ;;
    ltr-empty-scrolled) swipe "$XR" "$YE" "$XL"; shot "$tag-1-scrolled"; swipe "$XL" "$YE" "$XR"; shot "$tag-2-after" ;;
    ltr-card-start) swipe "$XL" "$YC" "$XR"; shot "$tag-1-after" ;;
    edge) swipe 4 "$YC" "$XR"; shot "$tag-1-after" ;;
    hold-rtl) hold_drag "$XR" "$YC" "$XL" "$tag" && shot "$tag-1-after" ;;
    hold-ltr) hold_drag "$XL" "$YC" "$XR" "$tag" && shot "$tag-1-after" ;;
  esac
  adb logcat -d > "$OUT/$tag-logcat.txt"
}

cases_for() {
  case "$1" in
    v2-*) echo "ltr-card-start edge hold-ltr" ;;
    *) echo "rtl-card rtl-empty ltr-card-scrolled ltr-empty-scrolled ltr-card-start edge hold-rtl hold-ltr" ;;
  esac
}

start_metro() {
  local v="$1"
  (cd "$ROOT/apps/stage" && CI=1 EXPO_NO_TELEMETRY=1 setsid bunx expo start --port 8081 > "$OUT/metro-$v.log" 2>&1 &)
  for _ in $(seq 1 120); do
    curl -sf http://localhost:8081/status 2>/dev/null | grep -q running && break
    sleep 2
  done
  log "metro status: $(curl -s http://localhost:8081/status)"
  local manifest bundle
  manifest="$(curl -s -H 'expo-platform: android' -H 'accept: application/expo+json,application/json' http://localhost:8081/)"
  printf '%s' "$manifest" > "$OUT/manifest-$v.json"
  bundle="$(printf '%s' "$manifest" | python3 -c "import json,sys; print(json.load(sys.stdin)['launchAsset']['url'])" 2>/dev/null)"
  log "bundle url: $bundle"
  if [ -n "$bundle" ]; then
    local t0=$SECONDS
    curl -s -o /dev/null -w '%{http_code} %{size_download}\n' --max-time 900 "$bundle"
    log "prewarm took $((SECONDS - t0))s"
  fi
}

stop_metro() {
  pkill -f "start --port 8081" || true
  sleep 3
}

adb wait-for-device
log "sdk $(adb shell getprop ro.build.version.sdk | tr -d '\r') abis $(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton || true
log "nav mode $(adb shell settings get secure navigation_mode | tr -d '\r')"
if ! adb install -r -g "$ROOT/stage-dev-client.apk" > "$OUT/install.txt" 2>&1; then
  log "install failed: $(cat "$OUT/install.txt")"
  exit 0
fi
adb reverse tcp:8081 tcp:8081
SIZE="$(adb shell wm size | tail -1 | awk '{print $NF}' | tr -d '\r')"
W="${SIZE%x*}"; H="${SIZE#*x}"
XL=$(( W * 20 / 100 )); XR=$(( W * 75 / 100 )); YC=$(( H * 30 / 100 )); YE=$(( H * 80 / 100 ))
log "screen ${W}x${H} density $(adb shell wm density | tail -1 | tr -d '\r') XL=$XL XR=$XR YC=$YC YE=$YE"

for v in $VARIANTS; do
  git -C "$ROOT" checkout -- apps/stage
  python3 "$ROOT/ci-repro/variant.py" "$v" || { log "variant $v failed to apply"; continue; }
  git -C "$ROOT" diff --stat -- apps/stage/lib/navigation apps/stage/components/board/BoardScreen.model.ts
  git -C "$ROOT" diff -- apps/stage/lib/navigation/rootStack.tsx > "$OUT/$v.diff"
  start_metro "$v"
  for c in $(cases_for "$v"); do run_case "$v" "$c"; done
  stop_metro
done
git -C "$ROOT" checkout -- apps/stage
log "done"
exit 0
