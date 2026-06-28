'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Meet Cosmo! — SVG character · Canvas starfield · Web Speech · Web Audio
// ═══════════════════════════════════════════════════════════════════════════

const PARTS = [
  { id:'ears',  label:'👂 Ears',
    explore:'These are my ears! I can hear everything you say! Can you wiggle your ears? I cannot wiggle mine at all — robots are rubbish at that!',
    quiz:'Can you find my ears?' },
  { id:'eyes',  label:'👀 Eyes',
    explore:'These are my eyes! I can see your lovely face right now! I love looking at all the colours around me. What can you see right now?',
    quiz:'Can you find my eyes?' },
  { id:'nose',  label:'👃 Nose',
    explore:'This is my nose! Your nose can smell wonderful things like cookies and flowers and fresh rain. What is your favourite smell?',
    quiz:'Can you tap my nose?' },
  { id:'mouth', label:'👄 Mouth',
    explore:'This is my mouth! I use it to talk and sing and smile at you! Can you give me your biggest smile right now?',
    quiz:'Can you find my mouth?' },
  { id:'tummy', label:'🤖 Tummy',
    explore:'This is my tummy! Your tummy is where all your food goes when you eat. Does your tummy ever make a funny rumbling noise when you are hungry?',
    quiz:'Can you find my tummy?' },
  { id:'hands', label:'🤲 Hands',
    explore:'These are my hands! I love to wave hello to all my friends. Can you wave your hands back at me right now?',
    quiz:'Can you find my hands?' },
  { id:'feet',  label:'🦶 Feet',
    explore:'These are my feet! I love to stomp and dance around the room. Can you stomp your feet on the floor too?',
    quiz:'Can you find my feet?' },
];

// ── State ───────────────────────────────────────────────────────────────────
let mode          = 'explore';
let quizParts     = [];
let quizIdx       = 0;
let score         = 0;
let currentScreen = 'splash';

// ── DOM refs ────────────────────────────────────────────────────────────────
const cosmoSvg  = document.getElementById('cosmo-svg');
const infoBar   = document.getElementById('info-bar');
const htmlFx    = document.getElementById('html-fx');
const scoreArea = document.getElementById('score-area');
const starsEl   = document.getElementById('stars');
const splashBtns = document.getElementById('splash-btns');

// SVG viewBox dimensions
const VBW = 420, VBH = 680;

// ── Starfield ────────────────────────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('star-canvas');
  const ctx    = canvas.getContext('2d');
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  const stars = Array.from({ length: 260 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.7 + 0.25,
    alpha: Math.random() * 0.6 + 0.35,
    speed: Math.random() * 0.6 + 0.2,
    phase: Math.random() * Math.PI * 2,
  }));
  let t = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    t += 0.018;
    for (const s of stars) {
      const a = s.alpha * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,222,255,${a.toFixed(3)})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
})();

// ── Web Audio ────────────────────────────────────────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, dur, type = 'sine', vol = 0.16) {
  try {
    const ac = getAudio(), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch (_) {}
}
function playTap()     { playTone(520, 0.12, 'sine', 0.14); }
function playCorrect() { [523,659,784].forEach((f,i) => setTimeout(() => playTone(f, 0.22, 'sine', 0.14), i * 80)); }
function playWrong()   { playTone(200, 0.3, 'sawtooth', 0.11); }
function playCheer()   { [523,587,659,698,784,880].forEach((f,i) => setTimeout(() => playTone(f, 0.28, 'sine', 0.13), i * 60)); }

// ── Web Speech ───────────────────────────────────────────────────────────────
const syn = window.speechSynthesis;
let voices = [];
const loadVoices = () => { voices = syn.getVoices(); };
loadVoices();
syn.onvoiceschanged = loadVoices;

function pickVoice() {
  // Prefer US/AU female voices — avoids strong UK accent
  const pref = [
    v => /en[-_](US|CA)/i.test(v.lang) && /female|girl|junior|zira|susan|karen/i.test(v.name),
    v => /en[-_](AU|NZ)/i.test(v.lang),
    v => /en[-_](US|CA)/i.test(v.lang),
    v => /en/i.test(v.lang) && /female|girl/i.test(v.name),
    v => /en/i.test(v.lang),
    () => true,
  ];
  for (const fn of pref) { const v = voices.find(fn); if (v) return v; }
  return null;
}

function speak(text, onEnd) {
  if (!text) { if (onEnd) onEnd(); return; }
  syn.cancel();
  const u   = new SpeechSynthesisUtterance(text);
  u.pitch   = 1.65;
  u.rate    = 0.92;
  u.volume  = 1;
  const v   = pickVoice();
  if (v) u.voice = v;
  u.onend = u.onerror = () => { if (onEnd) onEnd(); };
  syn.speak(u);
}

// ── Screens ──────────────────────────────────────────────────────────────────
function showScreen(id) {
  currentScreen = id;
  document.querySelectorAll('.ui-layer').forEach(el => {
    el.classList.add('hidden'); el.classList.remove('active');
  });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
}

// ── Info bar ─────────────────────────────────────────────────────────────────
function setInfoBar(text) {
  infoBar.textContent = text;
  infoBar.classList.remove('pop');
  void infoBar.offsetWidth;
  infoBar.classList.add('pop');
}

// ── Eye tracking (face-centre reference — prevents crossing) ─────────────────
const leftIrisG  = document.getElementById('left-iris-g');
const rightIrisG = document.getElementById('right-iris-g');
// Face centre in SVG viewBox units
const FACE_CX = 210, FACE_CY = 170;

function svgCoords(clientX, clientY) {
  const rect = cosmoSvg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width  * VBW,
    y: (clientY - rect.top)  / rect.height * VBH,
  };
}

function updateEyes(clientX, clientY) {
  const { x, y } = svgCoords(clientX, clientY);
  const dx   = x - FACE_CX;
  const dy   = y - FACE_CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const max  = 7;
  const s    = dist > 0 ? Math.min(max, dist) / dist : 0;
  const tx   = (dx * s).toFixed(2);
  const ty   = (dy * s).toFixed(2);
  // Both irises move in the same direction — no crossing ever
  leftIrisG.setAttribute('transform',  `translate(${tx},${ty})`);
  rightIrisG.setAttribute('transform', `translate(${tx},${ty})`);
}

window.addEventListener('mousemove', e => updateEyes(e.clientX, e.clientY));
window.addEventListener('touchmove', e => {
  if (e.touches[0]) updateEyes(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

// ── Blinking (eyelid sweeps TOP → DOWN, natural blink) ───────────────────────
const leftLidRect  = document.getElementById('left-lid-rect');
const rightLidRect = document.getElementById('right-lid-rect');
const EYE_LID_MAX  = 62; // full height of eye circle (r=31, diameter=62)

function doBlink() {
  let t = 0;
  (function step() {
    t += 0.09;
    const h = Math.sin(Math.min(t, Math.PI)) * EYE_LID_MAX;
    leftLidRect.setAttribute('height',  h.toFixed(1));
    rightLidRect.setAttribute('height', h.toFixed(1));
    if (t < Math.PI) requestAnimationFrame(step);
    else {
      leftLidRect.setAttribute('height', '0');
      rightLidRect.setAttribute('height', '0');
    }
  })();
}

(function schedBlink() {
  setTimeout(() => { doBlink(); schedBlink(); }, 2800 + Math.random() * 3800);
})();

// ── Hit detection (SVG coordinate-space, priority: small targets first) ───────
function dist2(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }

function getPartAt(x, y) {
  if (dist2(x, y, 210, 216) < 30 * 30) return 'nose';
  if (dist2(x, y, 166, 170) < 44 * 44) return 'eyes';
  if (dist2(x, y, 254, 170) < 44 * 44) return 'eyes';
  if (x > 158 && x < 262 && y > 244 && y < 304) return 'mouth';
  // Ears: outside face panel (x < 112 or x > 308)
  if (x < 114 && y > 152 && y < 236) return 'ears';
  if (x > 306 && y > 152 && y < 236) return 'ears';
  // Hands hang down — updated positions
  if (dist2(x, y, 74, 468) < 56 * 56) return 'hands';
  if (dist2(x, y, 346, 468) < 56 * 56) return 'hands';
  // Tummy (yellow square area)
  if (x > 152 && x < 268 && y > 362 && y < 480) return 'tummy';
  // Feet
  if (x > 115 && x < 305 && y > 578 && y < 642) return 'feet';
  return null;
}

// ── Flash ─────────────────────────────────────────────────────────────────────
const PART_GROUP = {
  ears:'part-ears', eyes:'part-eyes', nose:'part-nose',
  mouth:'part-mouth', tummy:'part-tummy', hands:'part-hands', feet:'part-feet',
};

function flashPart(partId) {
  const el = document.getElementById(PART_GROUP[partId]);
  if (!el) return;
  el.style.filter = 'brightness(2.6) saturate(0.2)';
  setTimeout(() => { el.style.filter = ''; }, 200);
}

function bounceCosmo() {
  // Temporarily override the float animation
  cosmoSvg.style.animationPlayState = 'paused';
  cosmoSvg.style.transition = 'transform 0.08s ease-out';
  cosmoSvg.style.transform  = 'translateY(-10px) scale(1.05)';
  setTimeout(() => {
    cosmoSvg.style.transition = 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1)';
    cosmoSvg.style.transform  = '';
    setTimeout(() => {
      cosmoSvg.style.transition = '';
      cosmoSvg.style.animationPlayState = '';
    }, 440);
  }, 90);
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const COLOURS = ['#FF6B6B','#FFC300','#39D353','#00B4D8','#FF9EBC','#FF7F50','#8A2BE2'];
function spawnConfetti(n = 75) {
  htmlFx.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = [
      `left:${5 + Math.random() * 90}%`,
      `width:${8 + Math.random() * 10}px`,
      `height:${8 + Math.random() * 10}px`,
      `background:${COLOURS[Math.floor(Math.random() * COLOURS.length)]}`,
      `animation-duration:${2.2 + Math.random() * 1.4}s`,
      `animation-delay:${Math.random() * 0.6}s`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
    ].join(';');
    htmlFx.appendChild(el);
  }
  setTimeout(() => { htmlFx.innerHTML = ''; }, 4000);
}

// ── Part tap ──────────────────────────────────────────────────────────────────
function onPartTapped(partId) {
  const part = PARTS.find(p => p.id === partId);
  if (!part) return;
  playTap();
  flashPart(partId);
  bounceCosmo();

  if (mode === 'explore') {
    setInfoBar(part.label);
    speak(part.explore);
  } else {
    const target = quizParts[quizIdx];
    if (partId === target.id) {
      playCorrect();
      score++;
      starsEl.textContent = '⭐'.repeat(score);
      speak(`Well done! That's right!`, () => {
        quizIdx++;
        if (quizIdx >= quizParts.length) endQuiz();
        else nextQuestion();
      });
    } else {
      playWrong();
      speak('Oops! Try again!');
    }
  }
}

// ── SVG click / touch ─────────────────────────────────────────────────────────
cosmoSvg.addEventListener('click', e => {
  if (currentScreen !== 'game') return;
  const { x, y } = svgCoords(e.clientX, e.clientY);
  const partId = getPartAt(x, y);
  if (partId) onPartTapped(partId);
});

cosmoSvg.addEventListener('touchstart', e => {
  if (currentScreen !== 'game') return;
  e.preventDefault();
  const t = e.touches[0];
  const { x, y } = svgCoords(t.clientX, t.clientY);
  const partId = getPartAt(x, y);
  if (partId) onPartTapped(partId);
}, { passive: false });

// ── Explore mode ──────────────────────────────────────────────────────────────
function startExplore() {
  mode = 'explore';
  showScreen('game');
  scoreArea.classList.add('hidden');
  setInfoBar('Tap any part of Cosmo!');
  speak('Tap any part of my body to find out what it is called!');
}

// ── Quiz mode ─────────────────────────────────────────────────────────────────
function startQuiz() {
  mode      = 'quiz';
  score     = 0;
  quizParts = [...PARTS].sort(() => Math.random() - 0.5);
  quizIdx   = 0;
  starsEl.textContent = '';
  showScreen('game');
  scoreArea.classList.remove('hidden');
  nextQuestion();
}

function nextQuestion() {
  const target = quizParts[quizIdx];
  setInfoBar(target.quiz);
  speak(target.quiz);
}

function endQuiz() {
  playCheer();
  spawnConfetti(80);
  const msg = `Amazing! You found all ${PARTS.length} of my body parts! You are incredible!`;
  setInfoBar('🎉 Amazing!');
  speak(msg);
  setTimeout(() => {
    showScreen('splash');
    splashBtns.classList.remove('hidden');
  }, 5500);
}

// ── Back button ───────────────────────────────────────────────────────────────
document.getElementById('btn-quit').addEventListener('click', () => {
  syn.cancel();
  showScreen('splash');
  splashBtns.classList.remove('hidden');
});

// ── Mode buttons ──────────────────────────────────────────────────────────────
document.getElementById('btn-explore').addEventListener('click', startExplore);
document.getElementById('btn-quiz').addEventListener('click', startQuiz);

// ── Splash intro ──────────────────────────────────────────────────────────────
async function initSplash() {
  splashBtns.classList.add('hidden');
  showScreen('splash');
  if (!voices.length) {
    await new Promise(resolve => {
      syn.onvoiceschanged = () => { loadVoices(); resolve(); };
      setTimeout(resolve, 1600);
    });
    loadVoices();
  }
  speak(
    'Hello there! I am Cosmo, your friendly robot! I would love to be your friend. Tap different parts of my body to learn all about body parts!',
    () => { splashBtns.classList.remove('hidden'); }
  );
}

initSplash();
