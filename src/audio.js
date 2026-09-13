/*
 * audio.js - tiny synthesized SFX + music via WebAudio.
 * Nothing is created until the first user interaction (audioStart), per policy.
 * M toggles mute. State persists in localStorage.
 */

let actx = null, master = null, musicGain = null, musicTimer = 0, musicStep = 0;
let muted = localStorage.getItem('rg_mute') === '1';

function audioStart() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window['webkitAudioContext'])();
  } catch (e) { return; }
  master = actx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(actx.destination);
  musicGain = actx.createGain();
  musicGain.gain.value = 0.28;
  musicGain.connect(master);
  startMusic();
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem('rg_mute', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.5;
}

function tone(freq, dur, type, vol, slide, dest) {
  if (!actx) return;
  let o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, actx.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.3, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, actx.currentTime + dur);
  o.connect(g);
  g.connect(dest || master);
  o.start();
  o.stop(actx.currentTime + dur + 0.02);
}

function noiseBurst(dur, vol, freq) {
  if (!actx) return;
  let n = Math.floor(actx.sampleRate * dur);
  let buf = actx.createBuffer(1, n, actx.sampleRate);
  let d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  let src = actx.createBufferSource();
  src.buffer = buf;
  let f = actx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq || 900;
  let g = actx.createGain();
  g.gain.value = vol || 0.4;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

// kind: 0 shoot, 1 hit, 2 splat, 3 power, 4 hurt, 5 upgrade, 6 over, 7 combo
function sfx(kind) {
  if (!actx || muted) return;
  if (kind === 0) tone(680, 0.06, 'square', 0.12, 240);
  else if (kind === 1) tone(420, 0.05, 'triangle', 0.16, 120);
  else if (kind === 2) noiseBurst(0.18, 0.35, 700);
  else if (kind === 3) { tone(520, 0.12, 'triangle', 0.25, 400); tone(780, 0.14, 'triangle', 0.2, 500); }
  else if (kind === 4) { tone(200, 0.25, 'sawtooth', 0.3, -120); noiseBurst(0.2, 0.25, 500); }
  else if (kind === 5) { tone(523, 0.1, 'square', 0.2); setTimeout(() => tone(784, 0.16, 'square', 0.2), 90); }
  else if (kind === 6) { tone(330, 0.5, 'sawtooth', 0.35, -220); }
  else if (kind === 7) tone(880, 0.08, 'square', 0.18, 300);
}

// A short looping chiptune: bass + arpeggio in a bright major feel.
let BASS = [110, 110, 146.83, 130.81];
let ARP = [440, 554.37, 659.25, 880, 659.25, 554.37, 523.25, 659.25];
function startMusic() {
  clearInterval(musicTimer);
  musicStep = 0;
  musicTimer = setInterval(function () {
    if (!actx || muted) return;
    let s = musicStep % 16;
    if (s % 4 === 0) tone(BASS[(musicStep >> 2) % 4], 0.22, 'triangle', 0.35, 0, musicGain);
    tone(ARP[s % 8] / 2, 0.12, 'square', 0.12, 0, musicGain);
    if (s % 2 === 0) tone(ARP[s % 8], 0.1, 'square', 0.09, 0, musicGain);
    musicStep++;
  }, 150);
}
