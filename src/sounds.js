/**
 * src/sounds.js — Global audio manager (singleton).
 *
 * Usage:
 *   startBG()           — play looping BG at normal speed (menu / gamedle / infinite)
 *   startSpeedrunBG()   — reset to normal speed then ramp up every 1.5 s
 *   stopSpeedrunBG()    — stop the ramp, keep BG playing at normal speed
 *   stopBG()            — pause + reset BG completely
 *   playWrong()         — play wrong-answer SFX
 *   playRight()         — play right-answer SFX
 *   setVolume(0–1)      — set BG volume
 *   setMuted(bool)      — mute / unmute everything
 *   getMuted()          — current mute state
 *   getVolume()         — current volume (0–1)
 */

const BASE = process.env.PUBLIC_URL || "";

// ── State ──────────────────────────────────────────────────────────────────────
let _bgAudio    = null;
let _volume     = 0.35;    // BG volume (SFX always at 0.7)
let _muted      = false;
let _rampTimer  = null;

// ── BG audio singleton ─────────────────────────────────────────────────────────
function getBG() {
  if (!_bgAudio) {
    _bgAudio         = new Audio(`${BASE}/BG_Loop.wav`);
    _bgAudio.loop    = true;
    _bgAudio.volume  = _muted ? 0 : _volume;
  }
  return _bgAudio;
}

function _stopRamp() {
  if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Start (or resume) BG at normal playback speed. */
export function startBG() {
  _stopRamp();
  const bg = getBG();
  bg.playbackRate = 1.0;
  bg.volume       = _muted ? 0 : _volume;
  bg.play().catch(() => {}); // browsers may block before first user gesture
}

/**
 * Speedrun mode — reset to 1.0× then increase by +0.04× every 1.5 s,
 * capped at 2.0× (equivalent to 240 BPM from the base 120 BPM track).
 */
export function startSpeedrunBG() {
  _stopRamp();
  const bg = getBG();
  bg.playbackRate = 1.0;
  bg.volume       = _muted ? 0 : _volume;
  bg.play().catch(() => {});

  _rampTimer = setInterval(() => {
    if (!_bgAudio) return;
    _bgAudio.playbackRate = Math.min(parseFloat((_bgAudio.playbackRate + 0.04).toFixed(3)), 2.0);
  }, 1500);
}

/** Called when speedrun ends — stop ramp and return to normal speed. */
export function stopSpeedrunBG() {
  _stopRamp();
  if (_bgAudio) _bgAudio.playbackRate = 1.0;
}

/** Fully stop the BG (e.g. on logout). */
export function stopBG() {
  _stopRamp();
  if (_bgAudio) {
    _bgAudio.pause();
    _bgAudio.currentTime = 0;
    _bgAudio.playbackRate = 1.0;
  }
}

// ── Volume / mute ──────────────────────────────────────────────────────────────
export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (_bgAudio) _bgAudio.volume = _muted ? 0 : _volume;
}

export function setMuted(m) {
  _muted = m;
  if (_bgAudio) _bgAudio.volume = m ? 0 : _volume;
}

export function getMuted()  { return _muted; }
export function getVolume() { return _volume; }

// ── SFX helpers ────────────────────────────────────────────────────────────────
function playSFX(src) {
  if (_muted) return;
  const a = new Audio(`${BASE}/${src}`);
  a.volume = 0.7;
  a.play().catch(() => {});
}

export const playWrong = () => playSFX("wrongAnsw.wav");
export const playRight = () => playSFX("rightGuess.mp3");
