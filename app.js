'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  Meet Cosmo! — 3D kids body-parts learning game
//  Three.js r152 · Web Speech API · Web Audio API
// ═══════════════════════════════════════════════════════════════════════════

// ── Body parts ──────────────────────────────────────────────────────────────
const PARTS = [
  { id:'ears',  label:'Ears',
    explore:'These are my ears! I use them to hear every sound around me!',
    quiz:'Can you find my ears?' },
  { id:'eyes',  label:'Eyes',
    explore:'These are my eyes! I can see all the wonderful colours of the world!',
    quiz:'Can you find my eyes?' },
  { id:'nose',  label:'Nose',
    explore:'This is my nose! It helps me smell all kinds of amazing things!',
    quiz:'Can you touch my nose?' },
  { id:'mouth', label:'Mouth',
    explore:'This is my mouth! I use it to talk, sing, and smile at you!',
    quiz:'Can you find my mouth?' },
  { id:'tummy', label:'Tummy',
    explore:'This is my tummy! My power core glows right inside here!',
    quiz:'Can you find my tummy?' },
  { id:'hands', label:'Hands',
    explore:'These are my hands! I love to wave hello and give high fives!',
    quiz:'Can you find my hands?' },
  { id:'feet',  label:'Feet',
    explore:'These are my feet! I dance and stomp around with these!',
    quiz:'Can you find my feet?' },
];

const BURST_COLS  = [0xFF6B6B, 0xF7DC6F, 0x4ECDC4, 0xA29BFE, 0xFD79A8, 0x00CEC9, 0x55EFC4];
const CONFETTI_CSS = ['#FF6B6B','#F7DC6F','#4ECDC4','#A29BFE','#FD79A8','#00CEC9','#55EFC4'];

// ── App state ────────────────────────────────────────────────────────────────
let currentScreen = 'splash';  // 'splash' | 'game'
let mode          = 'explore'; // 'explore' | 'quiz'
let busy          = false;
let quizQueue     = [];
let currentPart   = null;
let quizScore     = 0;

// ── Three.js globals ─────────────────────────────────────────────────────────
let scene, camera, renderer, clock;
let cosmoRoot;              // root Group for the whole robot
let partGroups = {};        // partId → THREE.Group (for raycasting)
let hitMeshes  = [];        // flat list of hittable meshes
let anims      = [];        // running animations: fn(dt) → keep?
let burstParticles = [];    // live 3D burst particles
let mouseNDC   = new THREE.Vector2(0, 0);
let idleT      = 0;
let blinkCountdown = 3;
let isSpeaking = false;
let camZ       = 7.5;       // current camera Z (lerped)
let camZTarget = 7.5;

// ── Materials ────────────────────────────────────────────────────────────────
let M; // material palette

function buildMaterials() {
  const ph = (col, shine, spec) =>
    new THREE.MeshPhongMaterial({ color: col, shininess: shine, specular: new THREE.Color(spec) });
  const std = (col, emissive, emInt, metal = 0, rough = 0.5) =>
    new THREE.MeshStandardMaterial({ color: col, emissive, emissiveIntensity: emInt, metalness: metal, roughness: rough });

  M = {
    body:     ph(0x5DADE2, 130, 0xBBDDFF),
    bodyDark: ph(0x1A6FA0, 100, 0x448ABB),
    gold:     ph(0xF39C12, 240, 0xFFEEAA),
    dark:     ph(0x1C2B3A, 60,  0x2A4055),
    darker:   ph(0x0E1824, 40,  0x1A2A3A),
    nose:     ph(0xE74C3C, 150, 0xFF9999),
    eyeWhite: ph(0xFFFFFF, 280, 0xFFFFFF),
    eyeIris:  std(0x2471A3, 0x2471A3, 0.6, 0.1, 0.3),
    eyePupil: ph(0x080E18, 20,  0x111111),
    screen:   std(0x1ABC9C, 0x0E8060, 1.1, 0, 0.4),
    screenDim:std(0x0E5040, 0x073828, 0.4, 0, 0.6),
    glow:     std(0xF1C40F, 0xF1C40F, 1.5, 0, 1),
    glowRed:  std(0xFF4444, 0xFF4444, 1.0, 0, 1),
    chrome:   ph(0xAABBCC, 200, 0xDDEEFF),
    hit:      new THREE.MeshBasicMaterial({ visible: false }),
  };
}

// ── Scene init ───────────────────────────────────────────────────────────────
function initThree() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040810);
  scene.fog = new THREE.FogExp2(0x040810, 0.014);

  const W = window.innerWidth, H = window.innerHeight;
  camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 300);
  camera.position.set(0, 0.3, camZ);

  const canvas = document.getElementById('cosmo-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  addLights();
  buildStarField();
  buildMaterials();

  cosmoRoot = buildCosmo();
  scene.add(cosmoRoot);

  window.addEventListener('resize', onResize);
  canvas.addEventListener('click',      onCanvasClick);
  canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
  window.addEventListener('mousemove',  onMouseMove);
  window.addEventListener('touchmove',  onTouchMoveForEyes, { passive: true });

  requestAnimationFrame(renderLoop);
}

// ── Lighting ─────────────────────────────────────────────────────────────────
function addLights() {
  // Ambient — deep space blue tint
  scene.add(new THREE.AmbientLight(0x223366, 1.4));

  // Key — warm upper-right
  const key = new THREE.DirectionalLight(0xFFEEDD, 2.2);
  key.position.set(4, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 20;
  key.shadow.bias = -0.001;
  scene.add(key);

  // Fill — cool left
  const fill = new THREE.DirectionalLight(0x6688FF, 0.7);
  fill.position.set(-5, 2, 3);
  scene.add(fill);

  // Rim — cyan from behind-top
  const rim = new THREE.DirectionalLight(0x00FFEE, 0.55);
  rim.position.set(0, 5, -7);
  scene.add(rim);

  // Under-glow — cool purple from below
  const under = new THREE.DirectionalLight(0x6633BB, 0.35);
  under.position.set(0, -5, 2);
  scene.add(under);

  // Screen glow — teal point at Cosmo's belly
  const scrPt = new THREE.PointLight(0x1ABC9C, 1.2, 5);
  scrPt.position.set(0, 0, 2.8);
  scene.add(scrPt);

  // Antenna glow — yellow point at top
  const antPt = new THREE.PointLight(0xFFDD00, 0.6, 3);
  antPt.position.set(0, 2.8, 0);
  scene.add(antPt);
}

// ── Star field ───────────────────────────────────────────────────────────────
function buildStarField() {
  // Main field
  const n = 3000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(Math.random() * 2 - 1);
    const r     = 50 + Math.random() * 80;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
    const t = Math.random();
    col[i*3] = 0.7 + t * 0.3; col[i*3+1] = 0.8 + t * 0.2; col[i*3+2] = 0.9 + t * 0.1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo,
    new THREE.PointsMaterial({ size: 0.2, vertexColors: true, sizeAttenuation: true })));

  // Large bright stars
  const bn = 60, bp = new Float32Array(bn * 3);
  for (let i = 0; i < bn; i++) {
    bp[i*3] = (Math.random()-0.5)*90; bp[i*3+1] = (Math.random()-0.5)*90; bp[i*3+2] = (Math.random()-0.5)*60-15;
  }
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  scene.add(new THREE.Points(bgeo, new THREE.PointsMaterial({ size: 0.55, color: 0xFFFFFF })));

  // Nebula glow: a few large faint sprites
  const nebColours = [0x1A0050, 0x003366, 0x001A40];
  nebColours.forEach((col, i) => {
    const light = new THREE.PointLight(col, 0.4, 60);
    light.position.set((i - 1) * 30, (i % 2 === 0 ? 1 : -1) * 20, -40);
    scene.add(light);
  });
}

// ── Robot builder ────────────────────────────────────────────────────────────
function addHit(group, mesh) {
  mesh.userData.part = group.userData.part;
  group.add(mesh);
  hitMeshes.push(mesh);
}

function buildCosmo() {
  const root = new THREE.Group();

  // ── SHADOW DISC ──
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.65;
  root.add(disc);

  // ── HEAD GROUP ──
  const headG = new THREE.Group();
  headG.position.y = 1.12;
  root.add(headG);

  // Head sphere
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.74, 64, 64), M.body.clone());
  headMesh.castShadow = true;
  headG.add(headMesh);

  // Head highlight (translucent upper dome)
  headG.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.73, 32, 32, 0, Math.PI*2, 0, 0.75),
    new THREE.MeshPhongMaterial({ color: 0xAADDFF, shininess: 60, transparent: true, opacity: 0.18 })
  ));

  // Equatorial seam ring
  const seamRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.03, 16, 80), M.dark.clone());
  seamRing.rotation.x = Math.PI / 2;
  headG.add(seamRing);

  // Face plate (subtle lighter panel)
  const facePlate = new THREE.Mesh(
    new THREE.SphereGeometry(0.71, 32, 32, -0.8, 1.6, 0.5, 1.8),
    new THREE.MeshPhongMaterial({ color: 0x7EC8E3, shininess: 60, transparent: true, opacity: 0.22 })
  );
  headG.add(facePlate);

  // ── ANTENNA ──
  const antG = new THREE.Group();
  antG.position.set(0, 0.74, 0);
  headG.add(antG);

  const antStick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 0.6, 16), M.gold.clone());
  antStick.position.set(0, 0.3, 0);
  antG.add(antStick);

  const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), M.glow.clone());
  antBall.position.y = 0.65;
  antBall.name = 'antBall';
  antG.add(antBall);

  const antRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 32), M.gold.clone());
  antRing.position.set(0, 0.65, 0);
  antG.add(antRing);

  // ── EARS ──
  const earsG = new THREE.Group();
  earsG.name = 'ears'; earsG.userData.part = 'ears';
  partGroups.ears = earsG;
  headG.add(earsG);

  [-1, 1].forEach(s => {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.14, 32), M.gold.clone());
    pad.rotation.z = Math.PI / 2;
    pad.position.set(s * 0.87, 0, 0);
    pad.castShadow = true;
    pad.userData.part = 'ears';
    earsG.add(pad); hitMeshes.push(pad);

    // LED dot
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), M.glow.clone());
    led.position.set(s * 0.96, 0, 0.03);
    earsG.add(led);

    // Invisible hit sphere (bigger target)
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), M.hit);
    h.position.set(s * 0.82, 0, 0);
    addHit(earsG, h);
  });

  // ── EYES ──
  const eyesG = new THREE.Group();
  eyesG.name = 'eyes'; eyesG.userData.part = 'eyes';
  partGroups.eyes = eyesG;
  headG.add(eyesG);

  [{ x: -0.26, name: 'leftIris' }, { x: 0.26, name: 'rightIris' }].forEach(({ x, name }) => {
    const eyeG = new THREE.Group();
    eyeG.position.set(x, 0.13, 0.67);

    // Socket recess
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 32), M.dark.clone());
    socket.position.z = -0.04;
    socket.userData.part = 'eyes';
    eyeG.add(socket); hitMeshes.push(socket);

    // White
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.18, 48, 48), M.eyeWhite.clone());
    white.userData.part = 'eyes';
    eyeG.add(white); hitMeshes.push(white);

    // Iris group (tracked by eye tracking system)
    const irisG = new THREE.Group();
    irisG.name = name;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 32), M.eyeIris.clone());
    iris.position.set(0, 0, 0.08);
    irisG.add(iris);
    // Pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 24), M.eyePupil.clone());
    pupil.position.set(0, 0, 0.14);
    irisG.add(pupil);
    // Shine
    const shine1 = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), M.eyeWhite.clone());
    shine1.position.set(0.04, 0.04, 0.16);
    irisG.add(shine1);
    const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), M.eyeWhite.clone());
    shine2.position.set(-0.02, -0.03, 0.17);
    irisG.add(shine2);
    eyeG.add(irisG);
    eyesG.add(eyeG);
  });

  // Hit strip across both eyes
  const eyeHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.18), M.hit);
  eyeHit.position.set(0, 0.13, 0.6);
  addHit(eyesG, eyeHit);

  // ── NOSE ──
  const noseG = new THREE.Group();
  noseG.name = 'nose'; noseG.userData.part = 'nose';
  noseG.position.set(0, -0.07, 0.72);
  partGroups.nose = noseG;
  headG.add(noseG);

  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 32), M.nose.clone());
  noseMesh.userData.part = 'nose';
  noseG.add(noseMesh); hitMeshes.push(noseMesh);
  const noseShine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M.eyeWhite.clone());
  noseShine.position.set(0.035, 0.035, 0.065);
  noseG.add(noseShine);
  addHit(noseG, new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), M.hit));

  // Cheek blush (subtle pink sphere either side)
  [-1, 1].forEach(s => {
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xFF8888, transparent: true, opacity: 0.18 })
    );
    blush.position.set(s * 0.34, -0.18, 0.64);
    headG.add(blush);
  });

  // ── MOUTH ──
  const mouthG = new THREE.Group();
  mouthG.name = 'mouth'; mouthG.userData.part = 'mouth';
  mouthG.position.set(0, -0.27, 0.69);
  partGroups.mouth = mouthG;
  headG.add(mouthG);

  const mouthMat = new THREE.MeshPhongMaterial({ color: 0x1A252F, shininess: 40 });
  for (let i = 0; i <= 8; i++) {
    const t = i / 8 - 0.5;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), mouthMat);
    dot.position.set(t * 0.44, Math.abs(t) * 0.2 - 0.1, 0);
    dot.userData.part = 'mouth';
    mouthG.add(dot); hitMeshes.push(dot);
  }
  // Inner glow (simulates open mouth when speaking)
  const innerMouth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xFF3322, emissive: 0x661100, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
  );
  innerMouth.position.z = -0.01;
  innerMouth.name = 'innerMouth';
  mouthG.add(innerMouth);
  addHit(mouthG, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.18), M.hit));

  // ── BODY ──
  const bodyG = new THREE.Group();
  bodyG.position.y = -0.15;
  root.add(bodyG);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.18, 0.92), M.body.clone());
  torso.castShadow = true; torso.receiveShadow = true;
  bodyG.add(torso);

  // Chest panel lines
  [0.24, -0.24].forEach(y => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.038, 0.93), M.bodyDark.clone());
    line.position.y = y;
    bodyG.add(line);
  });

  // Shoulder caps (gold domes)
  [-1, 1].forEach(s => {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 32, 32, 0, Math.PI*2, 0, Math.PI/2),
      M.gold.clone()
    );
    cap.rotation.z = s > 0 ? Math.PI/2 : -Math.PI/2;
    cap.position.set(s * 0.64, 0.52, 0);
    bodyG.add(cap);
  });

  // Side ventilation ribs
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, 0.22), M.darker.clone());
      rib.position.set(s * 0.65, -0.08 + i * 0.13, 0.12);
      bodyG.add(rib);
    }
  });

  // ── TUMMY SCREEN ──
  const tummyG = new THREE.Group();
  tummyG.name = 'tummy'; tummyG.userData.part = 'tummy';
  tummyG.position.set(0, 0.04, 0.47);
  partGroups.tummy = tummyG;
  bodyG.add(tummyG);

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.64, 0.06),
    new THREE.MeshPhongMaterial({ color: 0x040A16, shininess: 120, specular: 0x2244AA }));
  bezel.userData.part = 'tummy';
  tummyG.add(bezel); hitMeshes.push(bezel);

  const screenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.54, 0.022), M.screen.clone());
  screenMesh.position.z = 0.04;
  screenMesh.name = 'screenMesh';
  screenMesh.userData.part = 'tummy';
  tummyG.add(screenMesh); hitMeshes.push(screenMesh);

  // Scan-line effect (horizontal strips)
  for (let i = 0; i < 5; i++) {
    const sl = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.01, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    sl.position.set(0, -0.24 + i * 0.12, 0.052);
    tummyG.add(sl);
  }

  const tummyHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.4), M.hit);
  tummyHit.position.set(0, 0, 0.15);
  addHit(tummyG, tummyHit);

  // ── ARMS ──
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.138, 0.56, 16, 32),
      M.body.clone()
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(s * 0.93, -0.06, 0);
    arm.castShadow = true;
    bodyG.add(arm);

    // Elbow ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.032, 10, 32), M.dark.clone());
    ring.rotation.y = Math.PI / 2;
    ring.position.set(s * 0.72, -0.06, 0);
    bodyG.add(ring);
  });

  // ── HANDS ──
  const handsG = new THREE.Group();
  handsG.name = 'hands'; handsG.userData.part = 'hands';
  partGroups.hands = handsG;
  bodyG.add(handsG);

  [-1, 1].forEach(s => {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.235, 48, 48), M.gold.clone());
    hand.position.set(s * 1.25, -0.06, 0);
    hand.castShadow = true;
    hand.userData.part = 'hands';
    handsG.add(hand); hitMeshes.push(hand);

    // Knuckle rings
    [0.08, -0.08].forEach(dy => {
      const kr = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 8, 24), M.dark.clone());
      kr.rotation.z = Math.PI / 2;
      kr.position.set(s * 1.25, -0.06 + dy, 0);
      handsG.add(kr);
    });

    // Hand shine
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3, shininess: 300 }));
    shine.position.set(s * (1.25 - 0.11), 0.04, 0.16);
    handsG.add(shine);

    // Hit sphere
    const handHit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), M.hit);
    handHit.position.set(s * 1.25, -0.06, 0);
    addHit(handsG, handHit);
  });

  // ── LEGS ──
  const legMat = new THREE.MeshPhongMaterial({ color: 0x1A6FA0, shininess: 130, specular: 0x4488BB });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.52, 16, 32), legMat.clone());
    leg.position.set(s * 0.3, -1.1, 0);
    leg.castShadow = true;
    bodyG.add(leg);

    // Knee cap
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), M.gold.clone());
    knee.position.set(s * 0.3, -0.84, 0.05);
    bodyG.add(knee);
  });

  // ── FEET ──
  const feetG = new THREE.Group();
  feetG.name = 'feet'; feetG.userData.part = 'feet';
  partGroups.feet = feetG;
  bodyG.add(feetG);

  const footMat = new THREE.MeshPhongMaterial({ color: 0x1A252F, shininess: 90, specular: 0x334466 });
  const toeMat  = new THREE.MeshPhongMaterial({ color: 0x253545, shininess: 80, specular: 0x448899 });
  [-1, 1].forEach(s => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.58), footMat.clone());
    foot.position.set(s * 0.3, -1.46, 0.12);
    foot.castShadow = true; foot.receiveShadow = true;
    foot.userData.part = 'feet';
    feetG.add(foot); hitMeshes.push(foot);

    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.2), toeMat.clone());
    toe.position.set(s * 0.3, -1.46, 0.38);
    feetG.add(toe);

    // Gold sole stripe
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.60), M.gold.clone());
    sole.position.set(s * 0.3, -1.548, 0.12);
    feetG.add(sole);

    const footHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.72), M.hit);
    footHit.position.set(s * 0.3, -1.46, 0.12);
    addHit(feetG, footHit);
  });

  return root;
}

// ── Render loop ──────────────────────────────────────────────────────────────
function renderLoop() {
  requestAnimationFrame(renderLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  idleT += dt;

  // Camera smooth zoom
  camZ += (camZTarget - camZ) * 0.06;
  camera.position.z = camZ;

  if (cosmoRoot) {
    // Idle float
    cosmoRoot.position.y = Math.sin(idleT * 0.85) * 0.09;

    // Splash: slow showcase rotation. Game: face front, track mouse slightly
    if (currentScreen === 'splash') {
      cosmoRoot.rotation.y += dt * 0.38;
    } else {
      const targetY = mouseNDC.x * 0.22;
      const targetX = -mouseNDC.y * 0.08;
      cosmoRoot.rotation.y += (targetY - cosmoRoot.rotation.y) * 0.06;
      cosmoRoot.rotation.x += (targetX - cosmoRoot.rotation.x) * 0.06;
    }

    // Antenna pulse
    const ab = cosmoRoot.getObjectByName('antBall');
    if (ab) {
      ab.material.emissiveIntensity = 1.0 + Math.sin(idleT * 3.5) * 0.5;
      ab.scale.setScalar(1 + Math.sin(idleT * 3.5) * 0.08);
    }

    // Screen shimmer
    const sm = cosmoRoot.getObjectByName('screenMesh');
    if (sm) sm.material.emissiveIntensity = 0.85 + Math.sin(idleT * 2.2) * 0.2;

    // Mouth open/close when speaking
    const im = cosmoRoot.getObjectByName('innerMouth');
    if (im) im.material.opacity = isSpeaking ? 0.55 + Math.sin(idleT * 18) * 0.35 : 0;

    // Eye tracking
    updateEyeTracking();

    // Eye blink
    blinkCountdown -= dt;
    if (blinkCountdown <= 0) { doBlink(); blinkCountdown = 3.5 + Math.random() * 3; }
  }

  // Run animation queue
  for (let i = anims.length - 1; i >= 0; i--) {
    if (!anims[i](dt)) anims.splice(i, 1);
  }

  // Update 3D burst particles
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.life -= dt * 1.4;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= dt * 2.5; // gravity
    p.mesh.scale.setScalar(Math.max(0, p.life));
    p.mesh.material.opacity = Math.max(0, p.life * 1.2);
    if (p.life <= 0) { scene.remove(p.mesh); burstParticles.splice(i, 1); }
  }

  renderer.render(scene, camera);
}

// ── Eye tracking ─────────────────────────────────────────────────────────────
function updateEyeTracking() {
  ['leftIris', 'rightIris'].forEach(name => {
    const iris = cosmoRoot.getObjectByName(name);
    if (!iris) return;
    const tx = THREE.MathUtils.clamp(mouseNDC.x * 0.045, -0.045, 0.045);
    const ty = THREE.MathUtils.clamp(mouseNDC.y * 0.03,  -0.03,  0.03);
    iris.position.x += (tx - iris.position.x) * 0.12;
    iris.position.y += (ty - iris.position.y) * 0.12;
  });
}

// ── Eye blink ────────────────────────────────────────────────────────────────
function doBlink() {
  ['leftIris', 'rightIris'].forEach(name => {
    const iris = cosmoRoot.getObjectByName(name);
    if (!iris) return;
    // Also find the white (parent)
    const eyeGroup = iris.parent;
    if (!eyeGroup) return;
    eyeGroup.children.forEach(c => {
      if (c === iris) return;
      const origY = c.scale.y;
      anims.push(makeScaleYAnim(c, 1, 0.04, 0.08, () =>
        anims.push(makeScaleYAnim(c, 0.04, 1, 0.1, null))
      ));
    });
  });
}

function makeScaleYAnim(obj, from, to, dur, onDone) {
  let t = 0;
  obj.scale.y = from;
  return (dt) => {
    t += dt / dur;
    obj.scale.y = THREE.MathUtils.lerp(from, to, Math.min(t, 1));
    if (t >= 1) { if (onDone) onDone(); return false; }
    return true;
  };
}

// ── 3D burst particles ────────────────────────────────────────────────────────
function burst3D(worldPos) {
  const geo = new THREE.SphereGeometry(0.07, 6, 6);
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: BURST_COLS[i % BURST_COLS.length],
      transparent: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldPos);
    scene.add(mesh);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3.5 + 1,
      (Math.random() - 0.5) * 3
    );
    burstParticles.push({ mesh, vel, life: 1 });
  }
}

// ── Part pop animation (scale bounce) ────────────────────────────────────────
function popGroup(group) {
  if (!group) return;
  let t = 0;
  anims.push((dt) => {
    t += dt * 5;
    const s = 1 + Math.sin(Math.min(t, Math.PI)) * 0.35;
    group.scale.setScalar(s);
    if (t >= Math.PI) { group.scale.setScalar(1); return false; }
    return true;
  });
}

// ── Highlight flash ───────────────────────────────────────────────────────────
function flashGroup(group) {
  if (!group) return;
  const origMats = [];
  const flash = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 100, transparent: true, opacity: 0.6 });
  group.traverse(obj => {
    if (obj.isMesh && obj.material !== M.hit) {
      origMats.push({ obj, mat: obj.material });
      obj.material = flash;
    }
  });
  setTimeout(() => origMats.forEach(({ obj, mat }) => { obj.material = mat; }), 180);
}

// ── Raycasting ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const _mouse2   = new THREE.Vector2();

function getHitPart(clientX, clientY) {
  const W = renderer.domElement.clientWidth;
  const H = renderer.domElement.clientHeight;
  _mouse2.x = (clientX / W) * 2 - 1;
  _mouse2.y = -(clientY / H) * 2 + 1;
  raycaster.setFromCamera(_mouse2, camera);
  const hits = raycaster.intersectObjects(hitMeshes, false);
  if (!hits.length) return null;
  return { part: hits[0].object.userData.part, point: hits[0].point };
}

function onCanvasClick(e) {
  if (currentScreen !== 'game') return;
  const hit = getHitPart(e.clientX, e.clientY);
  if (hit) onPartTapped(hit.part, partGroups[hit.part], hit.point);
}

function onCanvasTouchStart(e) {
  if (currentScreen !== 'game') return;
  e.preventDefault();
  const t = e.touches[0];
  const hit = getHitPart(t.clientX, t.clientY);
  if (hit) onPartTapped(hit.part, partGroups[hit.part], hit.point);
}

function onMouseMove(e) {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onTouchMoveForEyes(e) {
  mouseNDC.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
}

// ── Part interaction ─────────────────────────────────────────────────────────
function onPartTapped(partId, group, point) {
  if (mode === 'explore') {
    if (busy) return;
    const part = PARTS.find(p => p.id === partId);
    if (!part) return;
    busy = true;
    sfx.touch();
    showBubble(part.label);
    flashGroup(group);
    popGroup(group);
    burst3D(point || new THREE.Vector3());
    speak(part.explore).then(() => { busy = false; });

  } else if (mode === 'quiz') {
    if (!currentPart || busy) return;
    if (partId === currentPart.id) {
      busy = true;
      sfx.success();
      showBubble('🎉 ' + currentPart.label + '!');
      flashGroup(group);
      popGroup(group);
      burst3D(point || new THREE.Vector3());
      quizScore++;
      updateStars();
      speak("Well done! That's right!").then(() => { busy = false; setTimeout(nextQuestion, 300); });
    } else {
      sfx.wrong();
      // Shake wrong group
      if (partGroups[partId]) {
        const g = partGroups[partId];
        let t = 0;
        anims.push((dt) => {
          t += dt * 14;
          g.position.x = Math.sin(t) * 0.06 * Math.exp(-t * 0.3);
          if (t > 4) { g.position.x = 0; return false; }
          return true;
        });
      }
      speak('Oops! Try again!');
    }
  }
}

// ── Quiz ─────────────────────────────────────────────────────────────────────
function updateStars() {
  document.getElementById('stars').textContent = '⭐'.repeat(quizScore);
}

function nextQuestion() {
  if (quizQueue.length === 0) { endQuiz(); return; }
  currentPart = quizQueue.shift();
  document.getElementById('quiz-q').textContent = currentPart.quiz;
  speak(currentPart.quiz);
}

async function endQuiz() {
  currentPart = null;
  sfx.cheer();
  showBubble('🎉 Amazing! All done!');
  htmlConfetti();
  await speak(`Amazing! You found all ${PARTS.length} of my body parts! You are incredible!`);
  stopQuiz();
}

function startQuiz() {
  quizQueue = [...PARTS].sort(() => Math.random() - 0.5);
  quizScore = 0; currentPart = null; busy = false;
  mode = 'quiz';
  document.getElementById('mode-badge').textContent = '⭐ Quiz Time!';
  document.getElementById('quiz-panel').classList.remove('hidden');
  document.getElementById('score-area').classList.remove('hidden');
  updateStars();
  nextQuestion();
}

function stopQuiz() {
  mode = 'explore';
  currentPart = null;
  document.getElementById('mode-badge').textContent = '🔍 Explore';
  document.getElementById('quiz-panel').classList.add('hidden');
  document.getElementById('score-area').classList.add('hidden');
}

// ── HTML confetti ─────────────────────────────────────────────────────────────
function htmlConfetti() {
  const fx = document.getElementById('html-fx');
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti';
      const w = 8 + Math.random() * 10;
      el.style.cssText = `
        left:${Math.random()*100}vw;
        background:${CONFETTI_CSS[Math.floor(Math.random()*CONFETTI_CSS.length)]};
        width:${w}px; height:${w}px;
        border-radius:${Math.random()>0.4?'50%':'3px'};
        animation-duration:${1.3+Math.random()*1.4}s;
        animation-delay:${Math.random()*0.6}s;
      `;
      fx.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }, i * 38);
  }
}

// ── Label bubble ─────────────────────────────────────────────────────────────
let bubbleTimer;
function showBubble(text) {
  clearTimeout(bubbleTimer);
  const b = document.getElementById('label-bubble');
  document.getElementById('bubble-text').textContent = text;
  b.classList.remove('hidden', 'pop');
  void b.offsetWidth;
  b.classList.add('pop');
  bubbleTimer = setTimeout(() => b.classList.add('hidden'), 3400);
}

// ── Web Speech ────────────────────────────────────────────────────────────────
const syn = window.speechSynthesis;
let voices = [];
syn.onvoiceschanged = () => { voices = syn.getVoices(); };
setTimeout(() => { voices = syn.getVoices(); }, 300);

function speak(text) {
  return new Promise(resolve => {
    syn.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.88; u.pitch = 1.15; u.volume = 1;
    const v = voices.find(v => v.lang.startsWith('en') && /samantha|hazel|kate|zira|google uk/i.test(v.name))
           || voices.find(v => v.lang.startsWith('en'))
           || voices[0];
    if (v) u.voice = v;
    u.onstart  = () => { isSpeaking = true; };
    u.onend    = () => { isSpeaking = false; resolve(); };
    u.onerror  = () => { isSpeaking = false; resolve(); };
    setTimeout(() => { isSpeaking = false; resolve(); }, 10000);
    syn.speak(u);
  });
}

// ── Web Audio ─────────────────────────────────────────────────────────────────
let audioCtx;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
  try {
    const ctx = ac(), t = ctx.currentTime + delay;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    // Add a tiny reverb via delay node for warmth
    const dly  = ctx.createDelay(0.3);
    const dGain = ctx.createGain();
    dly.delayTime.value = 0.12;
    dGain.gain.value = 0.18;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.connect(dly); dly.connect(dGain); dGain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.02);
  } catch (_) {}
}

const sfx = {
  touch()   { tone(523, 0.2); tone(659, 0.15, 'sine', 0.12, 0.08); },
  success() {
    [[523,0],[659,0.1],[784,0.2],[1047,0.3]].forEach(([f,d]) => tone(f, 0.22, 'sine', 0.18, d));
    tone(1319, 0.35, 'sine', 0.14, 0.42);
  },
  wrong()   { tone(330, 0.14, 'square', 0.12); tone(275, 0.24, 'square', 0.1, 0.16); },
  cheer()   {
    [[523,0],[587,0.08],[659,0.16],[784,0.24],[880,0.32],[988,0.4],[1047,0.48],[1319,0.58]]
      .forEach(([f,d]) => tone(f, 0.25, 'sine', 0.16, d));
  },
};

// ── Screen management ─────────────────────────────────────────────────────────
function showScreen(id) {
  currentScreen = id;
  document.querySelectorAll('.overlay').forEach(o => {
    o.classList.remove('active');
    o.classList.add('hidden');
  });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }

  if (id === 'game') {
    camZTarget = 5.2;
    document.getElementById('label-bubble').classList.add('hidden');
  } else {
    camZTarget = 7.5;
  }
}

// ── Resize ────────────────────────────────────────────────────────────────────
function onResize() {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initThree();

  document.getElementById('btn-explore').addEventListener('click', () => {
    mode = 'explore';
    document.getElementById('mode-badge').textContent = '🔍 Explore';
    showScreen('game');
    setTimeout(() => speak('Tap any part of my body to find out what it is called!'), 400);
  });

  document.getElementById('btn-quiz').addEventListener('click', () => {
    showScreen('game');
    setTimeout(startQuiz, 500);
  });

  document.getElementById('btn-quit').addEventListener('click', () => {
    syn.cancel(); isSpeaking = false;
    stopQuiz(); busy = false;
    showScreen('splash');
    setTimeout(initSplash, 500);
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  initSplash();
});

async function initSplash() {
  const btns = document.getElementById('splash-btns');
  btns.classList.add('hidden');
  await speak('Hi there! I am Cosmo! Your robot friend. Tap different parts of my body to learn what they are called!');
  btns.classList.remove('hidden');
}
