#!/usr/bin/env python3
"""Generate small local WAV sound files for nq-towers.

Creates:
- assets/bgm.wav
- assets/shoot.wav
- assets/enemy-die.wav

Uses only Python's standard library.
"""

import math
import os
import struct
import wave

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
SAMPLE_RATE = 44100


def _write_wav(path: str, samples: list[float], sample_rate: int = SAMPLE_RATE) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        frames = b"".join(
            struct.pack(
                "<h",
                max(-32768, min(32767, int(sample * 32767))),
            )
            for sample in samples
        )
        wf.writeframes(frames)


def _envelope(samples: list[float], attack_s: float, release_s: float, sample_rate: int = SAMPLE_RATE) -> list[float]:
    n = len(samples)
    a = int(attack_s * sample_rate)
    r = int(release_s * sample_rate)
    out = samples[:]

    for i in range(n):
        env = 1.0
        if a and i < a:
            env *= i / a
        if r and i > n - r:
            env *= max(0.0, (n - i) / r)
        out[i] *= env

    return out


def _sine(freq_hz: float, duration_s: float, amp: float) -> list[float]:
    n = int(duration_s * SAMPLE_RATE)
    return [amp * math.sin(2 * math.pi * freq_hz * (i / SAMPLE_RATE)) for i in range(n)]


def main() -> None:
    bgm_path = os.path.abspath(os.path.join(ASSETS_DIR, "bgm.wav"))
    shoot_path = os.path.abspath(os.path.join(ASSETS_DIR, "shoot.wav"))
    die_path = os.path.abspath(os.path.join(ASSETS_DIR, "enemy-die.wav"))

    # bgm: soft two-tone drone (short loop-friendly bed)
    sec = 2.0
    n = int(sec * SAMPLE_RATE)
    bgm = []
    for i in range(n):
        t = i / SAMPLE_RATE
        s = 0.12 * math.sin(2 * math.pi * 220 * t) + 0.08 * math.sin(2 * math.pi * 277.18 * t)
        bgm.append(s)
    bgm = _envelope(bgm, attack_s=0.05, release_s=0.10)
    _write_wav(bgm_path, bgm)

    # shoot: short blip
    shoot = _sine(880, 0.08, amp=0.35)
    shoot = _envelope(shoot, attack_s=0.002, release_s=0.03)
    _write_wav(shoot_path, shoot)

    # enemy-die: descending tone
    dur = 0.25
    n = int(dur * SAMPLE_RATE)
    die = []
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 440 - 260 * (t / dur)
        die.append(0.30 * math.sin(2 * math.pi * freq * t))
    die = _envelope(die, attack_s=0.005, release_s=0.08)
    _write_wav(die_path, die)

    print("Wrote:")
    print(" -", bgm_path)
    print(" -", shoot_path)
    print(" -", die_path)


if __name__ == "__main__":
    main()
