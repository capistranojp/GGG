/**
 * src/sounds.js — Global audio manager (singleton).
 */
const BASE = process.env.PUBLIC_URL || "";

let _bgAudio   = null;
let _volume    = 0.35;
let _muted     = false;
let _rampTimer = null;

function getBG() {
  if (!_bgAudio) {
    _bgAudio        = new Audio(`${BASE}/BG_Loop.wav`);
    _bgAudio.loop   = true;
    _bgAudio.volume = _muted ? 0 : _volume;
  }
  return _bgAudio;
}

function _stopRamp() {
  if (_rampTimer) { clearInterval(_rampTimer); _rampTimer = null; }
}

export function startBG() {
  _stopRamp();
  const bg = getBG();
  bg.playbackRate = 1.0;
  bg.volume       = _muted ? 0 : _volume;
  bg.play().catch(() => {});
}

export function startSpeedrunBG() {
  _stopRamp();
  const bg = getBG();
  bg.playbackRate = 1.0;
  bg.volume       = _muted ? 0 : _volume;
  bg.play().catch(() => {});
  _rampTimer = setInterval(() => {
    if (!_bgAudio) return;
    _bgAudio.playbackRate = Math.min(
      parseFloat((_bgAudio.playbackRate + 0.04).toFixed(3)), 2.0
    );
  }, 1500);
}

export function stopSpeedrunBG() {
  _stopRamp();
  if (_bgAudio) _bgAudio.playbackRate = 1.0;
}

export function stopBG() {
  _stopRamp();
  if (_bgAudio) {
    _bgAudio.pause();
    _bgAudio.currentTime  = 0;
    _bgAudio.playbackRate = 1.0;
  }
}

export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  if (_bgAudio) _bgAudio.volume = _muted ? 0 : _volume;
}

export function setMuted(m) {
  _muted = m;
  if (_bgAudio) _bgAudio.volume = m ? 0 : _volume;
}

export function getMuted()  { return _muted;  }
export function getVolume() { return _volume; }

function playSFX(src) {
  if (_muted) return;
  const a = new Audio(`${BASE}/${src}`);
  a.volume = 0.7;
  a.play().catch(() => {});
}

export const playWrong = () => playSFX("wrongAnsw.wav");
export const playRight = () => playSFX("rightGuess.mp3");
