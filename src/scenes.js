/*
 * scenes.js - scene state machine + input (keyboard, mouse, touch).
 * Loaded before game.js; only defines functions/handlers that run at runtime.
 */

let scene = 'title';
let paused = false;
let lock = 0;              // input lock timestamp (ms) to avoid accidental taps
let cardRects = [];        // upgrade card hit-boxes for pointer selection

function setScene(s) {
  scene = s;
  lock = Date.now() + 320;
  paused = false;
}

function startGame() {
  audioStart();
  resetGame();
  lastHalves = [100, 100];
  setScene('play');
}

function locked() { return Date.now() < lock; }

function primaryAction() {
  if (locked()) return;
  if (scene === 'title' || scene === 'over') { startGame(); return; }
  if (scene === 'play') {
    if (paused) return;
    player.dir *= -1;                 // reverse orbit
    return;
  }
  if (scene === 'upgrade') { applyUpgrade(choices[sel]); }
}

function setupInput() {
  window.addEventListener('keydown', function (e) {
    let k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); primaryAction(); }
    else if (k === 'ArrowLeft' && scene === 'upgrade' && !locked()) sel = (sel + 2) % 3;
    else if (k === 'ArrowRight' && scene === 'upgrade' && !locked()) sel = (sel + 1) % 3;
    else if (k === 'm' || k === 'M') toggleMute();
    else if ((k === 'p' || k === 'P' || k === 'Escape') && scene === 'play') paused = !paused;
  });

  function pointer(e) {
    e.preventDefault();
    audioStart();
    let rect = canvas.getBoundingClientRect();
    let px = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    let py = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    if (scene === 'upgrade' && !locked()) {
      for (let i = 0; i < cardRects.length; i++) {
        let c = cardRects[i];
        if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) { sel = i; applyUpgrade(choices[i]); return; }
      }
      return;
    }
    primaryAction();
  }
  canvas.addEventListener('mousedown', pointer);
  canvas.addEventListener('touchstart', pointer, { passive: false });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && scene === 'play') paused = true;
  });
}

// ---- overlay rendering per scene ----
function panel(a) { ctx.fillStyle = 'rgba(4,6,15,' + a + ')'; ctx.fillRect(0, 0, W, H); }

function drawScene() {
  let big = Math.max(30, R * 0.075);
  if (scene === 'title') {
    panel(0.45);
    rainbowText('RAINBOW GUARDIAN', CX, CY - R * 0.13, big);
    text('Guard the double rainbow. Slay the slop.', CX, CY - R * 0.04, R * 0.028, '#cfe0ff');
    let blink = 0.5 + 0.5 * Math.sin(now * 4);
    ctx.globalAlpha = blink;
    text('PRESS SPACE  /  TAP TO START', CX, CY + R * 0.05, R * 0.032, '#fff');
    ctx.globalAlpha = 1;
    text('SPACE/CLICK reverse orbit  \u00B7  auto-fire  \u00B7  M mute  \u00B7  P pause',
      CX, CY + R * 0.12, R * 0.022, '#8fb0ff');
    text('BEST ' + best, CX, CY + R * 0.17, R * 0.024, '#ffe37a');
  } else if (scene === 'upgrade') {
    panel(0.55);
    text('CHOOSE AN UPGRADE', CX, CY - R * 0.2, big * 0.7, '#fff');
    text('\u2190 \u2192 or tap a card, SPACE to confirm', CX, CY - R * 0.14, R * 0.024, '#8fb0ff');
    cardRects = [];
    let cw = Math.min(R * 0.26, W * 0.29), ch = R * 0.26, gap = cw * 0.12;
    let total = cw * 3 + gap * 2, x0 = CX - total / 2;
    for (let i = 0; i < 3; i++) {
      let x = x0 + i * (cw + gap), y = CY - ch / 2;
      cardRects.push({ x: x, y: y, w: cw, h: ch });
      let on = i === sel;
      ctx.fillStyle = on ? 'rgba(60,90,180,.9)' : 'rgba(20,26,48,.9)';
      ctx.fillRect(x, y, cw, ch);
      ctx.lineWidth = on ? 4 : 2; ctx.strokeStyle = on ? '#ffe37a' : '#4a5a8f';
      ctx.strokeRect(x, y, cw, ch);
      text(choices[i].n, x + cw / 2, y + ch * 0.35, cw * 0.11, '#fff');
      wrapText(choices[i].d, x + cw / 2, y + ch * 0.6, cw * 0.075, '#cfe0ff', cw * 0.85);
    }
  } else if (scene === 'over') {
    panel(0.6);
    rainbowText('GAME OVER', CX, CY - R * 0.1, big);
    text('SCORE ' + score, CX, CY, R * 0.04, '#fff');
    text('BEST ' + best, CX, CY + R * 0.06, R * 0.03, '#ffe37a');
    let blink = 0.5 + 0.5 * Math.sin(now * 4);
    ctx.globalAlpha = blink;
    text('PRESS SPACE / TAP TO PLAY AGAIN', CX, CY + R * 0.15, R * 0.03, '#fff');
    ctx.globalAlpha = 1;
  } else if (paused) {
    panel(0.5);
    text('PAUSED', CX, CY, big, '#fff');
    text('P / ESC to resume', CX, CY + R * 0.08, R * 0.028, '#8fb0ff');
  }
}

function rainbowText(str, x, y, size) {
  ctx.font = '900 ' + size + 'px system-ui,Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let g = ctx.createLinearGradient(x - size * 3, 0, x + size * 3, 0);
  for (let i = 0; i < 7; i++) g.addColorStop(i / 6, SPECTRUM[i]);
  ctx.lineWidth = Math.max(2, size * 0.06); ctx.strokeStyle = '#0a0f22';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = g; ctx.fillText(str, x, y);
}

function wrapText(str, x, y, size, color, maxw) {
  ctx.font = '700 ' + size + 'px system-ui,Arial,sans-serif';
  let words = str.split(' '), line = '', yy = y;
  for (let i = 0; i < words.length; i++) {
    let test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxw && line) { text(line, x, yy, size, color); line = words[i] + ' '; yy += size * 1.2; }
    else line = test;
  }
  text(line, x, yy, size, color);
}
