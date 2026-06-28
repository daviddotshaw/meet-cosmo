'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Meet Cosmo! — SVG character, Canvas starfield, Web Speech + Web Audio
// ═══════════════════════════════════════════════════════════════════════════

const PARTS = [
  { id:'ears',  label:'Ears',
    explore:'These are my ears! I can hear everything you say! Can you wiggle your ears? I cannot wiggle mine — robots are terrible at that!',
    quiz:'Can you find my ears?' },
  { id:'eyes',  label:'Eyes',
    explore:'These are my eyes! I can see your lovely face right now! I love looking at all the colours and shapes around me. What can you see right now?',
    quiz:'Can you find my eyes?' },
  { id:'nose',  label:'Nose',
    explore:'This is my nose! Your nose can smell wonderful things like cookies and flowers and fresh rain. What is your favourite smell?',
    quiz:'Can you tap my nose?' },
  { id:'mouth', label:'Mouth',
    explore:'This is my mouth! I use it to talk and sing and smile at you! Can you give me your biggest smile right now?',
    quiz:'Can you find my mouth?' },
  { id:'tummy', label:'Tummy',
    explore:'This is my tummy! I have a little glowing light inside my tummy — can you see it on my screen? Your tummy tells you when you are hungry. Does your tummy ever rumble?',
    quiz:'Can you find my tummy?' },
  { id:'hands', label:'Hands',
    explore:'These are my hands! I love to wave hello to all my friends. Can you wave your hands back at me right now?',
    quiz:'Can you find my hands?' },
  { id:'feet',  label:'Feet',
    explore:'These are my feet! I love to stomp and dance around the room. Can you stomp your feet on the floor too?',
    quiz:'Can you find my feet?' },
];

// ── State ───────────────────────────────────────────────────────────────────
let mode          = 'explore';   // 'explore' | 'quiz'
let quizParts     = [];
let quizIdx       = 0;
let score         = 0;
let speaking      = false;
let currentScreen = 'splash';
let blinkTimer    = null;

// ── DOM refs ────────────────────────────────────────────────────────────────
const cosmoSvg    = document.getElementById('cosmo-svg');
const labelBubble = document.getElementById('label-bubble');
const bubbleText  = document.getElementById('bubble-text');
const htmlFx      = document.getElementById('html-fx');
const quizPanel   = document.getElementById('quiz-panel');
const quizQ       = document.getElementById('quiz-q');
const scoreArea   = document.getElementById('score-area');
const starsEl     = document.getElementById('stars');
const modeBadge   = document.getElementById('mode-badge');
const splashBtns  = document.getElementById('splash-btns');

// SVG viewBox dimensions (must match the SVG)
const VBW = 420, VBH = 660;

// ── Starfield canvas ────────────────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('star-canvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const STAR_COUNT = 260;
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x:     Math.random(),
    y:     Math.random(),
    r:     Math.random() * 1.6 + 0.25,
    alpha: Math.random() * 0.6 + 0.35,
    speed: Math.random() * 0.6 + 0.2,
    phase: Math.random() * Math.PI * 2,
  }));

  let t = 0;
  function draw() {
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
  }
  draw();
})();

// ── Web Audio ───────────────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.18) {
  try {
    const ac  = getAudio();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch (_) {}
}

function playTap()     { playTone(520, 0.12, 'sine', 0.15); }
function playCorrect() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'sine', 0.15), i * 80));
}
function playWrong()   { playTone(200, 0.3, 'sawtooth', 0.12); }
function playCheer()   {
  [523,587,659,698,784,880].forEach((f, i) => setTimeout(() => playTone(f, 0.28, 'sine', 0.14), i * 60));
}

// ── Web Speech ──────────────────────────────────────────────────────────────
const syn = window.speechSynthesis;
let voices = [];

function loadVoices() {
  voices = syn.getVoices();
}
loadVoices();
syn.onvoiceschanged = loadVoices;

function pickVoice() {
  // Prefer a child/female UK or AU voice; fall back gracefully
  const pref = [
    v => /en[-_](GB|AU)/i.test(v.lang) && /female|girl|child|junior|fiona|kate|serena|veena|moira/i.test(v.name),
    v => /en[-_](GB|AU)/i.test(v.lang),
    v => /en[-_](US|CA)/i.test(v.lang) && /female|girl|junior/i.test(v.name),
    v => /en/i.test(v.lang),
    () => true,
  ];
  for (const fn of pref) {
    const v = voices.find(fn);
    if (v) return v;
  }
  return null;
}

function speak(text, onEnd) {
  if (!text) { if (onEnd) onEnd(); return; }
  syn.cancel();
  const u    = new SpeechSynthesisUtterance(text);
  u.pitch    = 1.65;
  u.rate     = 0.92;
  u.volume   = 1;
  const v    = pickVoice();
  if (v) u.voice = v;
  u.onend = u.onerror = () => { speaking = false; if (onEnd) onEnd(); };
  speaking = true;
  syn.speak(u);
}

// ── Screens ─────────────────────────────────────────────────────────────────
function showScreen(id) {
  currentScreen = id;
  document.querySelectorAll('.ui-layer').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
}

// ── Eye tracking ─────────────────────────────────────────────────────────────
const leftIrisG  = document.getElementById('left-iris-g');
const rightIrisG = document.getElementById('right-iris-g');

// Eye centres in SVG viewBox units
const LEFT_EYE  = { x: 166, y: 170 };
const RIGHT_EYE = { x: 254, y: 170 };

function svgCoords(clientX, clientY) {
  const rect = cosmoSvg.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width  * VBW,
    y: (clientY - rect.top)  / rect.height * VBH,
  };
}

function updateEyes(clientX, clientY) {
  const { x, y } = svgCoords(clientX, clientY);
  for (const [el, cx, cy] of [[leftIrisG, LEFT_EYE.x, LEFT_EYE.y], [rightIrisG, RIGHT_EYE.x, RIGHT_EYE.y]]) {
    const dx   = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const max  = 8;
    const s    = dist > 0 ? Math.min(max, dist) / dist : 0;
    el.setAttribute('transform', `translate(${(dx * s).toFixed(2)},${(dy * s).toFixed(2)})`);
  }
}

window.addEventListener('mousemove', e => updateEyes(e.clientX, e.clientY));
window.addEventListener('touchmove', e => {
  if (e.touches[0]) updateEyes(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

// ── Blinking ─────────────────────────────────────────────────────────────────
const leftLid  = document.getElementById('left-lid');
const rightLid = document.getElementById('right-lid');

function doBlink() {
  let t = 0;
  const step = () => {
    t += 0.1;
    const ry = Math.sin(Math.min(t, Math.PI)) * 32;
    leftLid.setAttribute('ry',  ry.toFixed(1));
    rightLid.setAttribute('ry', ry.toFixed(1));
    if (t < Math.PI) requestAnimationFrame(step);
    else { leftLid.setAttribute('ry', '0'); rightLid.setAttribute('ry', '0'); }
  };
  requestAnimationFrame(step);
}

function schedBlink() {
  const delay = 2800 + Math.random() * 3800;
  blinkTimer = setTimeout(() => { doBlink(); schedBlink(); }, delay);
}
schedBlink();

// ── Tummy dot pulse ──────────────────────────────────────────────────────────
(function pulseTummy() {
  const dot = document.getElementById('tummy-dot');
  if (!dot) return;
  let t = 0;
  function step() {
    t += 0.04;
    const r = 7 + Math.sin(t) * 3;
    dot.setAttribute('r', r.toFixed(1));
    requestAnimationFrame(step);
  }
  step();
})();

// ── Hit detection ────────────────────────────────────────────────────────────
function dist2(x1, y1, x2, y2) { return (x1 - x2) ** 2 + (y1 - y2) ** 2; }

function getPartAt(x, y) {
  // Priority: small targets first
  if (dist2(x, y, 210, 216) < 30 * 30) return 'nose';
  if (dist2(x, y, 166, 170) < 42 * 42) return 'eyes';
  if (dist2(x, y, 254, 170) < 42 * 42) return 'eyes';
  if (x > 158 && x < 262 && y > 244 && y < 304) return 'mouth';
  // Ears: outside the face panel (x < 112 or x > 310)
  if (x < 114 && y > 152 && y < 238) return 'ears';
  if (x > 306 && y > 152 && y < 238) return 'ears';
  // Hands
  if (dist2(x, y, 34, 337) < 52 * 52) return 'hands';
  if (dist2(x, y, 386, 337) < 52 * 52) return 'hands';
  // Tummy
  if (x > 126 && x < 294 && y > 336 && y < 492) return 'tummy';
  // Feet
  if (x > 115 && x < 305 && y > 568 && y < 632) return 'feet';
  return null;
}

// SVG group IDs for flash animation
const PART_GROUP = {
  ears:  'part-ears',
  eyes:  'part-eyes',
  nose:  'part-nose',
  mouth: 'part-mouth',
  tummy: 'part-tummy',
  hands: 'part-hands',
  feet:  'part-feet',
};

function flashPart(partId) {
  const el = document.getElementById(PART_GROUP[partId]);
  if (!el) return;
  el.style.filter = 'brightness(2.8) saturate(0.2)';
  setTimeout(() => { el.style.filter = ''; }, 200);
}

function bounceCosmo() {
  cosmoSvg.style.transition = 'transform 0.08s ease-out';
  cosmoSvg.style.transform  = 'translateY(-8px) scale(1.04)';
  setTimeout(() => {
    cosmoSvg.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
    cosmoSvg.style.transform  = '';
    setTimeout(() => { cosmoSvg.style.transition = ''; }, 420);
  }, 90);
}

// ── Label bubble ─────────────────────────────────────────────────────────────
function showBubble(text) {
  bubbleText.textContent = text;
  labelBubble.classList.remove('hidden', 'pop');
  void labelBubble.offsetWidth;  // reflow to restart animation
  labelBubble.classList.add('pop');
}

function hideBubble() {
  labelBubble.classList.add('hidden');
}

// ── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLOURS = ['#FF6B6B','#FFC300','#39D353','#00B4D8','#FF9EBC','#FF7F50','#8A2BE2'];

function spawnConfetti(n = 70) {
  htmlFx.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = [
      `left:${5 + Math.random() * 90}%`,
      `width:${8 + Math.random() * 10}px`,
      `height:${8 + Math.random() * 10}px`,
      `background:${CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)]}`,
      `animation-duration:${2.2 + Math.random() * 1.4}s`,
      `animation-delay:${Math.random() * 0.6}s`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
    ].join(';');
    htmlFx.appendChild(el);
  }
  setTimeout(() => { htmlFx.innerHTML = ''; }, 4000);
}

// ── Part tap handler ─────────────────────────────────────────────────────────
function onPartTapped(partId) {
  const part = PARTS.find(p => p.id === partId);
  if (!part) return;

  playTap();
  flashPart(partId);
  bounceCosmo();

  if (mode === 'explore') {
    showBubble(part.label);
    speak(part.explore);
  } else {
    // Quiz mode
    const target = quizParts[quizIdx];
    if (partId === target.id) {
      playCorrect();
      score++;
      starsEl.textContent = '⭐'.repeat(score);
      speak(`Well done! That's right!`, () => {
        quizIdx++;
        if (quizIdx >= quizParts.length) {
          endQuiz();
        } else {
          nextQuestion();
        }
      });
    } else {
      playWrong();
      speak('Oops! Try again!');
    }
  }
}

// ── SVG tap event ────────────────────────────────────────────────────────────
cosmoSvg.addEventListener('click', e => {
  if (currentScreen !== 'game') return;
  const touch = e.touches ? e.touches[0] : e;
  const { x, y } = svgCoords(touch.clientX || e.clientX, touch.clientY || e.clientY);
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
  modeBadge.textContent = '🔍 Explore';
  quizPanel.classList.add('hidden');
  scoreArea.classList.add('hidden');
  hideBubble();
  speak('Tap any part of my body to find out what it is called!');
}

// ── Quiz mode ─────────────────────────────────────────────────────────────────
function startQuiz() {
  mode  = 'quiz';
  score = 0;
  quizParts = [...PARTS].sort(() => Math.random() - 0.5);
  quizIdx   = 0;
  starsEl.textContent = '';
  showScreen('game');
  modeBadge.textContent = '⭐ Quiz!';
  scoreArea.classList.remove('hidden');
  hideBubble();
  nextQuestion();
}

function nextQuestion() {
  const target = quizParts[quizIdx];
  quizQ.textContent = target.quiz;
  quizPanel.classList.remove('hidden');
  speak(target.quiz);
}

function endQuiz() {
  quizPanel.classList.add('hidden');
  playCheer();
  spawnConfetti(80);
  const msg = `Amazing! You found all ${PARTS.length} of my body parts! You are incredible!`;
  speak(msg);
  showBubble('🎉');
  setTimeout(() => {
    hideBubble();
    showScreen('splash');
    splashBtns.classList.remove('hidden');
  }, 5500);
}

// ── Quit ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-quit').addEventListener('click', () => {
  syn.cancel();
  hideBubble();
  showScreen('splash');
  splashBtns.classList.remove('hidden');
});

// ── Button wiring ─────────────────────────────────────────────────────────────
document.getElementById('btn-explore').addEventListener('click', startExplore);
document.getElementById('btn-quiz').addEventListener('click', startQuiz);

// ── Splash intro ──────────────────────────────────────────────────────────────
async function initSplash() {
  splashBtns.classList.add('hidden');
  showScreen('splash');

  // Wait for voices to load (async on many browsers)
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
