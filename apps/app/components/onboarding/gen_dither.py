#!/usr/bin/env python3
"""Offline flipbook generator: animated source video/gif -> 1-bit dither flipbook.

This is the faithful reading of the Rodenbroeker technique AND of Less's
direction ("source = an animated gif/video, code turns each frame into those
rectangles"):

    load an ANIMATED source (mp4 / gif) -> for each sampled frame, step it on a
    fixed GRID -> per cell sample the source luminance -> quantize to 1-bit
    (pure #000 / #fff) via ordered (Bayer) dither -> nearest-neighbor upscale so
    the cells stay hard-edged RECTANGLES.

The MOTION (the face growing, the horizontal smear/stretch bands sweeping, the
ragged separator) is INHERITED from the source video - we do NOT synthesize it.
That is the whole point: the source stays crisp and the animation is real.

RECTANGULAR CELLS (this rev): Less asked for rectangles, not squares, AND to
keep the SOURCE's exact aspect ratio (no center-crop to a different ratio). So:

  - We DON'T crop the source. We read its native size and keep its proportions.
    The current Midjourney source is 464x832 (aspect 0.5577), so the output is
    696x1248 - the same 0.5577 aspect, just scaled up. No distortion, no crop.
  - The grid is GRID_W x GRID_H cells, and each cell is upscaled by a DIFFERENT
    horizontal vs vertical factor (CELL_W x CELL_H = 12x16 px), so every cell is
    a visible RECTANGLE (taller than wide, 3:4), not a square. 58x78 cells *
    12x16 px = 696x1248 output, which matches the source aspect exactly.

To use a DIFFERENT portrait later: drop a crisp animated source at SRC (any
mp4/gif ffmpeg can read). The output auto-tracks the source aspect: GRID_H is
derived from GRID_W so that (GRID_W*CELL_W):(GRID_H*CELL_H) == source W:H.

Output: apps/app/assets/onboarding-dither/f000.png .. f0NN.png  (OUT_W x OUT_H,
1-bit, nearest-neighbor upscaled from the GRID_W x GRID_H cell grid, rectangular
cells, source aspect preserved).

Re-run:  python3 apps/app/components/onboarding/gen_dither.py
Deps:    pillow, numpy, ffmpeg on PATH.
"""

from __future__ import annotations

import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source.mp4")
OUT_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "onboarding-dither"))

# --- Cell geometry. Cells are RECTANGLES (taller than wide, 3:4): CELL_W != CELL_H.
#     GRID_W is the column count; GRID_H (rows) is derived from the SOURCE's exact
#     aspect ratio so the output keeps the source proportions with NO crop/distort.
#     For the 464x832 Midjourney source this yields 58x78 cells -> 696x1248. ---
GRID_W = 58                    # columns (chosen for cell density ~= old reel)
CELL_W = 12                    # per-cell horizontal upscale (px)
CELL_H = 16                    # per-cell vertical upscale (px) -> rectangular 3:4

N_FRAMES = 36                  # flipbook length (one full source loop, evenly sampled)

# --- Contrast curve: lift the face off pure black, keep it punchy/crisp. ---
GAMMA = 0.85
DITHER_AMOUNT = 0.9

# 4x4 Bayer matrix, normalized to (0,1) thresholds (classic ordered dither).
BAYER4 = np.array(
    [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ],
    dtype=np.float64,
)
BAYER4 = (BAYER4 + 0.5) / 16.0  # -> thresholds in (0,1)


def src_size(src: str) -> tuple[int, int]:
    """Native (width, height) of the source video's first video stream."""
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0:s=x", src,
        ],
        capture_output=True, text=True, check=True,
    )
    w, h = probe.stdout.strip().split("x")
    return int(w), int(h)


def grid_rows(src_w: int, src_h: int) -> int:
    """Row count so the upscaled output keeps the source's EXACT aspect ratio:
       (GRID_W*CELL_W) / (rows*CELL_H) == src_w / src_h."""
    return round(GRID_W * CELL_W * src_h / (src_w * CELL_H))


def extract_frames(src: str, n: int, grid_h: int) -> list[np.ndarray]:
    """Pull N grayscale frames evenly across the WHOLE source clip, each
    area-downsampled onto the GRID_W x grid_h cell grid (honest per-cell
    luminance, no aliasing); returned as float64 [0,1] arrays.

    Looping source -> sample one detected loop. Non-looping (e.g. a Midjourney
    one-shot) -> boomerang so the flipbook still wraps with no pop."""
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-count_frames", "-show_entries", "stream=nb_read_frames",
            "-of", "default=nokey=1:noprint_wrappers=1", src,
        ],
        capture_output=True, text=True, check=True,
    )
    total = int(probe.stdout.strip())

    with tempfile.TemporaryDirectory() as td:
        # area-average each source frame straight onto the cell grid (no crop:
        # we scale the WHOLE frame to GRID_W x grid_h, which has the source
        # aspect, so proportions are preserved with no distortion).
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", src,
             "-vf", f"scale={GRID_W}:{grid_h}:flags=area,format=gray",
             os.path.join(td, "g%04d.png")],
            check=True,
        )
        all_g = [
            np.asarray(Image.open(os.path.join(td, f"g{i + 1:04d}.png")).convert("L"), dtype=np.float64)
            for i in range(total)
        ]
        period = detect_period(all_g, total)
        if period is not None:
            idxs = [round(i * period / n) % period for i in range(n)]
            return [all_g[i] / 255.0 for i in idxs]
        half = n // 2
        fwd = [round(i * (total - 1) / half) for i in range(half + 1)]  # 0..total-1
        seq = fwd + [fwd[j] for j in range(len(fwd) - 2, 0, -1)]        # mirror interior
        seq = seq[:n]
        return [all_g[i] / 255.0 for i in seq]


def detect_period(frames: list[np.ndarray], total: int) -> int | None:
    """Smallest p>1 such that frame p is a CLEAN repeat of frame 0 (the true
    source loop length). None when the clip does not loop."""
    base = frames[0]
    for p in range(2, total):
        d = float(np.abs(frames[p] - base).mean())
        if d < 2.0:
            return p
    return None


def dither_to_1bit(gray: np.ndarray) -> np.ndarray:
    """Ordered (Bayer) 1-bit quantization -> uint8 {0,255} at GRID resolution."""
    h, w = gray.shape
    tile = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    thresh = 0.5 + (tile - 0.5) * DITHER_AMOUNT
    return np.where(gray >= thresh, 255, 0).astype(np.uint8)


def main() -> None:
    if not os.path.exists(SRC):
        raise SystemExit(
            f"missing source animation: {SRC}\n"
            "Drop a crisp animated mp4/gif there (the reference portrait reel) "
            "and re-run."
        )
    sw, sh = src_size(SRC)
    grid_h = grid_rows(sw, sh)
    out_w, out_h = GRID_W * CELL_W, grid_h * CELL_H
    print(
        f"source {sw}x{sh} (aspect {sw / sh:.4f}) -> grid {GRID_W}x{grid_h} cells "
        f"@ {CELL_W}x{CELL_H}px -> out {out_w}x{out_h} (aspect {out_w / out_h:.4f})"
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.startswith("f") and f.endswith(".png"):
            os.remove(os.path.join(OUT_DIR, f))

    frames = extract_frames(SRC, N_FRAMES, grid_h)

    # global contrast normalization across the whole set
    stack = np.stack(frames)
    lo, hi = np.quantile(stack, 0.01), np.quantile(stack, 0.99)
    span = max(hi - lo, 1e-6)

    for i, g in enumerate(frames):
        g = np.clip((g - lo) / span, 0.0, 1.0)
        g = np.power(g, GAMMA)
        bits = dither_to_1bit(g)
        # nearest-neighbor upscale with DISTINCT x/y factors -> rectangular cells
        img = Image.fromarray(bits, mode="L").resize((out_w, out_h), Image.NEAREST)
        img.convert("1").save(os.path.join(OUT_DIR, f"f{i:03d}.png"))

    print(f"wrote {N_FRAMES} frames to {OUT_DIR} ({out_w}x{out_h}, 1-bit, rectangular cells)")


if __name__ == "__main__":
    main()
