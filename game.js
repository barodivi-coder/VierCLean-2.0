/* =========================================================
   VierCleanÓwno — prosta gra przeglądarkowa 3D (Three.js r128)
   ========================================================= */

// Widoczny na ekranie komunikat błędu — gdyby coś w skrypcie rzuciło
// wyjątkiem, zobaczysz to od razu w przeglądarce (górny czerwony pasek)
// zamiast cichej awarii bez śladu w interfejsie.
window.addEventListener('error', (e) => {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#E4572E;color:#fff;font:13px/1.4 monospace;padding:8px 12px;';
  bar.textContent = 'Błąd skryptu: ' + (e.message || e.error) + ' (linia ' + e.lineno + ')';
  document.body.appendChild(bar);
});

// ---------- Renderer / Scene / Camera ----------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xBFE6F5);
scene.fog = new THREE.Fog(0xBFE6F5, 60, 185);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);

function onViewportResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onViewportResize);
window.addEventListener('orientationchange', () => setTimeout(onViewportResize, 250));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onViewportResize);
}

// ---------- Toon shading helper ----------
function makeToonGradient() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  [70, 140, 200, 255].forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.Texture(c);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
const toonGradient = makeToonGradient();
function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient });
}

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x4c8f32, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(35, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);

// ---------- Field / Ground ----------
const FIELD = 30; // half-size of the playable meadow

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(FIELD * 2 + 6, FIELD * 2 + 6, 1, 1),
  toonMat(0x5FAE3E)
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// subtle darker patches for texture variety
const patchMat = toonMat(0x4C8F32);
for (let i = 0; i < 40; i++) {
  const patch = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random() * 2, 10), patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set((Math.random() * 2 - 1) * FIELD, 0.02, (Math.random() * 2 - 1) * FIELD);
  patch.receiveShadow = true;
  scene.add(patch);
}

// ---------- Background hills (Podkarpacie) ----------
// Wzgórza są rozstawione wokół środka CAŁEGO terenu (łąka + druga działka),
// żeby żaden fragment nie wszedł na żadną z dwóch płaszczyzn.
function addHills() {
  const hillMat = toonMat(0x4C8F32);
  const hillMat2 = toonMat(0x64A83F);
  const centerX = -30; // środek pomiędzy łąką a drugą działką
  for (let i = 0; i < 34; i++) {
    const angle = (i / 34) * Math.PI * 2;
    const dist = 95 + Math.random() * 32;
    const x = centerX + Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const r = 8 + Math.random() * 10;
    const h = 6 + Math.random() * 11;
    const geo = new THREE.SphereGeometry(r, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(geo, i % 2 === 0 ? hillMat : hillMat2);
    hill.position.set(x, -1.5, z);
    hill.scale.y = h / r;
    scene.add(hill);
  }
}
addHills();

// ---------- Fence (generic builder, reused by both plots) ----------
const postMat = toonMat(0xF7F5EF);
const railMat = toonMat(0xEDEAdd);
const FENCE_SPACING = 4;

// gateGroup holds the fence posts/rails covering the gate opening in the
// meadow's left fence — initially visible (gate closed), hidden once the
// player unlocks the second plot (gate opens).
const gateGroup = new THREE.Group();
scene.add(gateGroup);
let gateOpen = false;

function buildFenceSegment(x1, z1, x2, z2, gate) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.round(len / FENCE_SPACING);
  const angle = Math.atan2(dz, dx);

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.7, 8), postMat);
    post.position.set(x1 + dx * t, 0.85, z1 + dz * t);
    post.castShadow = true;
    if (gate && t >= gate.from && t <= gate.to) {
      gateGroup.add(post);
    } else {
      scene.add(post);
    }
  }

  function addRailPiece(a, b, isGate) {
    const segLen = len * (b - a);
    const midT = (a + b) / 2;
    [0.55, 1.15].forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.12, 0.12), railMat);
      rail.position.set(x1 + dx * midT, y, z1 + dz * midT);
      rail.rotation.y = -angle;
      rail.castShadow = true;
      (isGate ? gateGroup : scene).add(rail);
    });
  }

  if (gate) {
    if (gate.from > 0) addRailPiece(0, gate.from, false);
    addRailPiece(gate.from, gate.to, true);
    if (gate.to < 1) addRailPiece(gate.to, 1, false);
  } else {
    addRailPiece(0, 1, false);
  }
}

// Brama — otwór w lewej ścianie łąki, w narożniku GÓRNYM (z bliskie +FIELD).
const GATE_WIDTH = 10;
const GATE_Z_MAX = FIELD;
const GATE_Z_MIN = FIELD - GATE_WIDTH;
const GATE_FROM = 0;
const GATE_TO = GATE_WIDTH / (2 * FIELD);

// ---------- Meadow fence (with gate on the left side, top-left corner) ----------
function addMeadowFence() {
  const half = FIELD;
  buildFenceSegment(-half, -half, half, -half); // front
  buildFenceSegment(half, -half, half, half);   // right
  buildFenceSegment(half, half, -half, half);   // back
  // left side — carries the gate near its top-left corner (z close to +half)
  buildFenceSegment(-half, half, -half, -half, { from: GATE_FROM, to: GATE_TO });
}
addMeadowFence();

// ---------- Second plot: "ujeżdżalnia" (concrete yard + red arch hall) ----------
const PLOT2_X_MIN = -90;
const PLOT2_X_MAX = -30; // shared border with the meadow's left fence
const PLOT2_Z_MIN = -FIELD;
const PLOT2_Z_MAX = FIELD;
const PLOT2_CENTER_X = (PLOT2_X_MIN + PLOT2_X_MAX) / 2;

function makeConcreteTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#B7B6B0';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(90,88,82,0.35)';
  ctx.lineWidth = 3;
  const cell = size / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function addPlot2Ground() {
  const mat = new THREE.MeshToonMaterial({ map: makeConcreteTexture(), gradientMap: toonGradient });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT2_X_MAX - PLOT2_X_MIN, PLOT2_Z_MAX - PLOT2_Z_MIN),
    mat
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(PLOT2_CENTER_X, 0.01, 0);
  plane.receiveShadow = true;
  scene.add(plane);
}
addPlot2Ground();

function addPlot2Fence() {
  // only the 3 sides that are NOT shared with the meadow — the shared
  // border at x = PLOT2_X_MAX is already fenced (with the gate) by the meadow.
  buildFenceSegment(PLOT2_X_MIN, PLOT2_Z_MIN, PLOT2_X_MIN, PLOT2_Z_MAX); // far side
  buildFenceSegment(PLOT2_X_MIN, PLOT2_Z_MIN, PLOT2_X_MAX, PLOT2_Z_MIN); // near-z side
  buildFenceSegment(PLOT2_X_MIN, PLOT2_Z_MAX, PLOT2_X_MAX, PLOT2_Z_MAX); // far-z side
}
addPlot2Fence();

// ---------- Red arch hall ("hala łukowa") ----------
function createArchHall(length, width, wallHeight, color) {
  const group = new THREE.Group();
  const r = width / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  shape.lineTo(-r, wallHeight);
  shape.absarc(0, wallHeight, r, Math.PI, 0, true);
  shape.lineTo(r, 0);
  shape.lineTo(-r, 0);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 20 });
  const body = new THREE.Mesh(geo, toonMat(color));
  body.position.z = -length / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // ridge cap along the roof peak
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.15, 0.15), toonMat(0x7A2018));
  ridge.position.set(0, wallHeight + r, 0);
  group.add(ridge);

  // big closed doors on the two short (end) sides
  const doorMat = toonMat(0x33312F);
  const lineMat = toonMat(0x201F1D);
  const doorW = width * 0.62;
  const doorH = wallHeight * 0.92;
  [-1, 1].forEach((side) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), doorMat);
    door.position.set(0, doorH / 2, side * (length / 2 + 0.05));
    if (side < 0) door.rotation.y = Math.PI;
    group.add(door);
    for (let li = 1; li <= 2; li++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.94, 0.04, 0.02), lineMat);
      line.position.set(0, (doorH / 3) * li, side * (length / 2 + 0.06));
      group.add(line);
    }
  });

  return group;
}

function addHall() {
  const plotLen = PLOT2_X_MAX - PLOT2_X_MIN; // 60
  const plotWidth = PLOT2_Z_MAX - PLOT2_Z_MIN; // 60
  const hallLength = plotLen / 3;
  const hallWidth = plotWidth / 3;
  const gap = 2.5; // odstęp od ogrodzenia, żeby hala go nie przecinała

  const hall = createArchHall(hallLength, hallWidth, 3.2, 0xB3352A);
  // Obrócona o 90° względem poprzedniej wersji — bez rotacji Y oś długości
  // biegnie teraz wzdłuż Z (równolegle do ogrodzenia łąki), zamiast wgłąb działki.
  // Umieszczona blisko ogrodzenia z łąką, w rejonie dawnego (dolnego) narożnika bramy.
  const hallCenterX = PLOT2_X_MAX - hallWidth / 2 - gap;
  const hallCenterZ = -FIELD + hallLength / 2 + gap;
  hall.position.set(hallCenterX, 0, hallCenterZ);
  scene.add(hall);
}
addHall();

// ---------- Pan Janusz (character) ----------
function createJanusz() {
  const p = new THREE.Group();
  const skinMat = toonMat(0xE8B792);
  const hairMat = toonMat(0x585858);
  const shirtMat = toonMat(0xC0392B);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.38), shirtMat);
  torso.position.y = 0.33;
  torso.castShadow = true;
  p.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 20), skinMat);
  head.position.y = 0.9;
  head.castShadow = true;
  p.add(head);

  // grey hair as a band around the sides/back only, well below the crown —
  // added BEFORE the bald cap so the bald cap always renders on top and wins
  const hairSide = new THREE.Mesh(
    new THREE.SphereGeometry(0.278, 20, 20, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.42),
    hairMat
  );
  hairSide.position.y = 0.9;
  hairSide.castShadow = true;
  p.add(hairSide);

  // shiny bald patch right on top of the crown (clearly visible skin),
  // deliberately drawn last / slightly larger radius so it is never hidden
  const bald = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.4),
    skinMat
  );
  bald.position.y = 0.9;
  p.add(bald);

  // short full grey beard
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), hairMat);
  beard.position.set(0, 0.75, 0.19);
  beard.scale.set(1, 0.65, 0.75);
  p.add(beard);

  // arms
  const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.32, 0.38, 0.12);
  armL.rotation.z = 0.35;
  p.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.32, 0.38, 0.12);
  armR.rotation.z = -0.35;
  p.add(armR);

  return p;
}

// ---------- Tractor ----------
// NOTE: the movement code treats local +Z as "forward" and drives the
// *outer* group's rotation.y for steering. All the visual meshes below are
// modeled with the hood at -Z (that used to be treated as forward, which
// is why the tractor appeared to drive backwards). To fix that without
// touching every coordinate, everything is built inside an inner "visual"
// group that is rotated 180° — so the hood ends up pointing towards +Z,
// matching the actual direction of travel.
function createTractor() {
  const g = new THREE.Group();
  const visual = new THREE.Group();
  visual.rotation.y = Math.PI;
  g.add(visual);

  const bodyMat = toonMat(0x2E7D32);
  const bodyMat2 = toonMat(0x43A047);
  const blackMat = toonMat(0x252525);
  const yellowMat = toonMat(0xFFC145);

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 3.2), bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  visual.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 1.3), bodyMat2);
  hood.position.set(0, 1.05, -2.0);
  hood.castShadow = true;
  visual.add(hood);

  const grill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.1), blackMat);
  grill.position.set(0, 0.9, -2.66);
  visual.add(grill);

  // cabin roof — raised well above head height (head top sits around y=2.66)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.7), blackMat);
  roof.position.set(0, 3.05, 0.55);
  roof.castShadow = true;
  visual.add(roof);

  const pillarGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.98, 6);
  [[-0.85, -0.15], [0.85, -0.15], [-0.85, 1.25], [0.85, 1.25]].forEach(([x, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, blackMat);
    pillar.position.set(x, 2.01, z);
    visual.add(pillar);
  });

  const wheelGeoBig = new THREE.CylinderGeometry(0.85, 0.85, 0.5, 16);
  const wheelGeoSmall = new THREE.CylinderGeometry(0.52, 0.52, 0.38, 16);
  const rimMat = yellowMat;

  function makeWheel(geo, x, z) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(geo, blackMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    w.add(tire);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(geo.parameters.radiusTop * 0.45, geo.parameters.radiusTop * 0.45, geo.parameters.height + 0.03, 10),
      rimMat
    );
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    w.position.set(x, geo.parameters.radiusTop, z);
    return w;
  }

  const wheelRL = makeWheel(wheelGeoBig, -1.2, 1.0);
  const wheelRR = makeWheel(wheelGeoBig, 1.2, 1.0);
  const wheelFL = makeWheel(wheelGeoSmall, -1.05, -1.9);
  const wheelFR = makeWheel(wheelGeoSmall, 1.05, -1.9);
  visual.add(wheelRL, wheelRR, wheelFL, wheelFR);

  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), blackMat);
  pipe.position.set(0.65, 2.1, -1.85);
  visual.add(pipe);

  const janusz = createJanusz();
  janusz.position.set(-0.32, 1.5, 0.5);
  visual.add(janusz);

  g.userData.spinWheels = [wheelFL, wheelFR, wheelRL, wheelRR];
  g.userData.steerWheels = [wheelFL, wheelFR];
  return g;
}

const tractor = createTractor();
tractor.position.set(0, 0, 10);
scene.add(tractor);

// ---------- Input: keyboard ----------
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// ---------- Input: virtual joystick (mobile / touch) ----------
// x, y są znormalizowane do zakresu -1..1 względem środka bazy joysticka.
// y < 0 = gałka pchnięta w górę (do przodu), x > 0 = w prawo.
const joystick = { active: false, x: 0, y: 0 };
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
let joyPointerId = null;

function setJoystickFromClient(clientX, clientY) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joystick.x = dx / maxR;
  joystick.y = dy / maxR;
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {
  joystick.active = false;
  joystick.x = 0;
  joystick.y = 0;
  joyKnob.style.transform = 'translate(0px, 0px)';
}

if (joyBase) {
  joyBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joystick.active = true;
    joyPointerId = e.pointerId;
    if (joyBase.setPointerCapture) joyBase.setPointerCapture(e.pointerId);
    setJoystickFromClient(e.clientX, e.clientY);
  });
  joyBase.addEventListener('pointermove', (e) => {
    if (!joystick.active || e.pointerId !== joyPointerId) return;
    e.preventDefault();
    setJoystickFromClient(e.clientX, e.clientY);
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyPointerId) return;
    resetJoystick();
    joyPointerId = null;
  };
  joyBase.addEventListener('pointerup', endJoy);
  joyBase.addEventListener('pointercancel', endJoy);
}

// ---------- Tractor movement ----------
let speed = 0;
const maxSpeed = 9.5;
const accel = 15;
const friction = 11;
const turnSpeed = 2.2;
const DEADZONE = 0.14;

function updateTractor(dt) {
  let throttle = 0;
  if (keys['w'] || keys['arrowup']) {
    throttle = 1;
  } else if (keys['s'] || keys['arrowdown']) {
    throttle = -0.6;
  } else if (joystick.active) {
    const push = -joystick.y; // gałka w górę = jazda do przodu
    if (push > DEADZONE) throttle = Math.min(1, push);
    else if (push < -DEADZONE) throttle = Math.max(-0.6, push);
  }

  if (throttle !== 0) {
    speed += throttle * accel * dt;
  } else {
    speed -= Math.sign(speed) * friction * dt;
    if (Math.abs(speed) < 0.05) speed = 0;
  }
  speed = THREE.Math.clamp(speed, -maxSpeed * 0.5, maxSpeed);

  let turn = 0;
  if (keys['a'] || keys['arrowleft']) {
    turn = 1;
  } else if (keys['d'] || keys['arrowright']) {
    turn = -1;
  } else if (joystick.active && Math.abs(joystick.x) > DEADZONE) {
    turn = THREE.Math.clamp(-joystick.x * 1.3, -1, 1);
  }

  if (Math.abs(speed) > 0.15) {
    tractor.rotation.y += turn * turnSpeed * dt * (speed > 0 ? 1 : -1);
  }

  const dir = new THREE.Vector3(Math.sin(tractor.rotation.y), 0, Math.cos(tractor.rotation.y));
  let newX = tractor.position.x + dir.x * speed * dt;
  let newZ = tractor.position.z + dir.z * speed * dt;

  const marginZ = FIELD - 2.2;
  const outerMinX = gateOpen ? PLOT2_X_MIN + 2.2 : -(FIELD - 2.2);
  newX = THREE.Math.clamp(newX, outerMinX, FIELD - 2.2);
  newZ = THREE.Math.clamp(newZ, -marginZ, marginZ);

  // Ściana pomiędzy łąką a drugą działką (x = -FIELD) jest przenikalna
  // TYLKO w oknie bramy (GATE_Z_MIN..GATE_Z_MAX) i tylko gdy brama otwarta —
  // poza tym oknem działa jak zwykły płot, niezależnie od stanu bramy.
  const WALL_X = -FIELD;
  const WALL_MARGIN = 2.2;
  const inGateWindow = gateOpen && newZ >= GATE_Z_MIN - 0.5 && newZ <= GATE_Z_MAX + 0.5;
  if (!inGateWindow) {
    if (tractor.position.x >= WALL_X && newX < WALL_X + WALL_MARGIN) {
      newX = WALL_X + WALL_MARGIN;
    } else if (tractor.position.x < WALL_X && newX > WALL_X - WALL_MARGIN) {
      newX = WALL_X - WALL_MARGIN;
    }
  }

  tractor.position.x = newX;
  tractor.position.z = newZ;

  tractor.userData.spinWheels.forEach((w) => { w.rotation.x -= speed * dt * 1.8; });
  tractor.userData.steerWheels.forEach((w) => { w.rotation.y = turn * 0.35; });
}

// ---------- Camera follow ----------
function updateCamera() {
  const dir = new THREE.Vector3(Math.sin(tractor.rotation.y), 0, Math.cos(tractor.rotation.y));
  const behind = tractor.position.clone()
    .sub(dir.clone().multiplyScalar(7.6))
    .add(new THREE.Vector3(0, 4.4, 0));
  camera.position.lerp(behind, 0.09);
  const lookTarget = tractor.position.clone()
    .add(dir.clone().multiplyScalar(3))
    .add(new THREE.Vector3(0, 1.3, 0));
  camera.lookAt(lookTarget);
}

// ---------- Items ----------
const ITEM_TYPES = [
  { id: 'cat', bad: true, emoji: '🐱', text: 'Pan Janusz: O nieee! Na płycie obornikowej nie ma już miejsca na kolejne truchło kota!' },
  { id: 'yogurt', bad: false, emoji: '🥛', text: 'Pan Janusz: Jogurt proteinowy? Co za wymysł!' },
  { id: 'cheesecake', bad: false, emoji: '🍰', text: 'Pan Janusz: Tfu! Serniczek od razu na gnój!' },
  { id: 'keys', bad: false, emoji: '🔑', text: 'Pan Janusz: Oo kluczyki do tego durnego auta' },
  { id: 'pizza', bad: false, emoji: '🍕', text: 'Pan Janusz: Mmm moja pizza z Anglii!' },
  { id: 'shakshuka', bad: false, emoji: '🍳', text: 'Pan Janusz: Szakszuka? Przecież to nie niedziela...' },
  { id: 'paper', bad: false, emoji: '📄', text: 'Pan Janusz: I kolejna legitymacja martwej duszy ze Student Serwisu' },
  { id: 'eggs', bad: false, emoji: '🥚', text: 'Pan Janusz: Skąd tu się wzięły jajka od jajcarza z Sielca?' },
  { id: 'scarf', bad: false, emoji: '🧣', text: 'Pan Janusz: Oo chustka jakiejś baby ze wsi' },
  { id: 'wood', bad: false, emoji: '🪵', text: 'Pan Janusz: Drewno? Tadek stolarz się ucieszy' },
  { id: 'swimsuit', bad: false, emoji: '👙', text: 'Pan Janusz: Strój kąpielowy? Ktoś tu chyba ćwiczył do triathlonu' },
  { id: 'book', bad: false, emoji: '📖', text: 'Pan Janusz: Niemiecka książka o jeździectwie? Jak uczyć się to od najlepszych!' }
];
const GOOD_TYPES = ITEM_TYPES.filter(t => !t.bad);
const BAD_TYPES = ITEM_TYPES.filter(t => t.bad);
const WIN_TARGET_PER_ITEM = 2;

// Plansza ma zawsze tyle samo miejsc na dobre, co na złe przedmioty —
// dzięki temu nigdy nie zdarzy się plansza "same koty".
const GOOD_SLOTS = 3;
const BAD_SLOTS = 3;
const MAX_ITEMS = GOOD_SLOTS + BAD_SLOTS;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Kolejka dobrych przedmiotów na całą grę: DOKŁADNIE po 2 sztuki z każdego
// typu (tyle, ile trzeba do wygranej) — żaden dobry przedmiot nie pojawi
// się więcej razy niż gracz faktycznie potrzebuje.
let goodQueue = [];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeItemSprite(type) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Celowo TAKIE SAME tło i obramowanie dla dobrych i złych przedmiotów —
  // gracz musi rozpoznać ikonę, a nie kolor karty, żeby zwiększyć ryzyko pomyłki.
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, 8, 8, size - 16, size - 16, 26); ctx.fill();
  ctx.strokeStyle = '#FFC145';
  ctx.lineWidth = 7;
  roundRect(ctx, 8, 8, size - 16, size - 16, 26); ctx.stroke();
  ctx.font = '66px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type.emoji, size / 2, size / 2 + 6);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 2.3, 1);
  return sprite;
}

const activeItems = [];

function randomFieldPos() {
  const margin = 4;
  return new THREE.Vector3(
    (Math.random() * 2 - 1) * (FIELD - margin),
    1.3,
    (Math.random() * 2 - 1) * (FIELD - margin)
  );
}

function pickNextType() {
  const activeGood = activeItems.filter((it) => !it.userData.type.bad).length;
  const activeBad = activeItems.length - activeGood;

  // Utrzymuj równowagę: jeśli dobrych na planszy nie jest więcej niż
  // złych i w kolejce zostały jeszcze jakieś dobre przedmioty — dawaj dobry.
  if (activeGood <= activeBad && goodQueue.length > 0) {
    return goodQueue.shift();
  }
  // W przeciwnym razie zły (kot) — utrzymuje parytet dobre/złe.
  return BAD_TYPES[Math.floor(Math.random() * BAD_TYPES.length)];
}

function spawnItem() {
  if (!gameActive || activeItems.length >= MAX_ITEMS) return;
  const type = pickNextType();
  if (!type) return;

  const sprite = makeItemSprite(type);

  let pos, tries = 0;
  do { pos = randomFieldPos(); tries++; } while (pos.distanceTo(tractor.position) < 6 && tries < 12);

  sprite.position.copy(pos);
  sprite.userData = { type, baseY: pos.y };
  scene.add(sprite);
  activeItems.push(sprite);
}

function clearItems() {
  activeItems.forEach((it) => scene.remove(it));
  activeItems.length = 0;
}

function updateItems(dt, t) {
  for (let i = activeItems.length - 1; i >= 0; i--) {
    const it = activeItems[i];
    it.position.y = it.userData.baseY + Math.sin(t * 2 + i * 1.3) * 0.15;
    it.material.rotation += dt * 0.4;

    const dist = it.position.distanceTo(tractor.position);
    if (dist < 2.3) {
      handleCollect(it.userData.type);
      scene.remove(it);
      activeItems.splice(i, 1);
      setTimeout(spawnItem, 500 + Math.random() * 1300);
    }
  }
}

// ---------- Game state ----------
let score = 0;
let lives = 3;
let gameActive = false;
let speechTimer = null;
let itemCounts = {};
let plot2Unlocked = false;

const livesIcons = document.querySelectorAll('#lives .life-icon');
const scoreValueEl = document.getElementById('score-value');
const speechEl = document.getElementById('speech-bubble');
const dangerFlashEl = document.getElementById('danger-flash');
const hudEl = document.getElementById('hud');

function updateLivesUI() {
  livesIcons.forEach((icon, idx) => icon.classList.toggle('lost', idx >= lives));
}
function updateScoreUI() {
  scoreValueEl.textContent = score;
}
function showSpeech(text) {
  speechEl.textContent = text;
  speechEl.classList.add('visible');
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => speechEl.classList.remove('visible'), 3600);
}
function flashDanger() {
  dangerFlashEl.classList.add('active');
  setTimeout(() => dangerFlashEl.classList.remove('active'), 350);
}

const INTRO_LINES = [
  'Pan Janusz: Dzisiaj pokażę Ci jak posprzątać łąkę',
  'Pan Janusz: Dzięki temu będziesz później mogła sama posprzątać drogę gospodarczą',
  'Pan Janusz: Wtedy Rafał nie będzie tego robił, a on lubi pieniążki'
];

function playIntro() {
  INTRO_LINES.forEach((line, i) => {
    setTimeout(() => showSpeech(line), i * 3600);
  });
}

function checkWin() {
  return GOOD_TYPES.every((t) => (itemCounts[t.id] || 0) >= WIN_TARGET_PER_ITEM);
}

const UNLOCK_LINES = [
  'Pan Janusz: Dobra robota! Teraz musimy posprzątać ujeżdżalnie',
  'Pan Janusz: Wtedy zaoszczędzimy na Rafale, który lubi pieniążki'
];

function openGate() {
  gateGroup.visible = false;
  gateOpen = true;
}

// ---------- Big centered dialogue modal (pauses the game) ----------
let dialogueQueue = [];
let dialogueActive = false;
let dialogueOnComplete = null;
const dialogueModalEl = document.getElementById('dialogue-modal');
const dialogueTextEl = document.getElementById('dialogue-text');

function advanceDialogue() {
  if (!dialogueActive) return;
  if (dialogueQueue.length === 0) {
    dialogueModalEl.classList.add('hidden');
    dialogueActive = false;
    gameActive = true;
    const cb = dialogueOnComplete;
    dialogueOnComplete = null;
    if (cb) cb();
    return;
  }
  dialogueTextEl.textContent = dialogueQueue.shift();
  dialogueModalEl.classList.remove('hidden');
}

function showDialogueModal(lines, onComplete) {
  dialogueQueue = lines.slice();
  dialogueOnComplete = onComplete || null;
  dialogueActive = true;
  gameActive = false; // pauza — traktor i przedmioty zamrożone, dopóki gracz nie przeklika
  advanceDialogue();
}

window.addEventListener('keydown', (e) => {
  if (dialogueActive && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) {
    e.preventDefault();
    advanceDialogue();
  }
});
dialogueModalEl.addEventListener('click', () => { if (dialogueActive) advanceDialogue(); });
dialogueModalEl.addEventListener('touchstart', (e) => {
  if (dialogueActive) { e.preventDefault(); advanceDialogue(); }
}, { passive: false });

function playUnlockSequence() {
  showDialogueModal(UNLOCK_LINES, openGate);
}

function handleCollect(type) {
  if (type.bad) {
    lives = Math.max(0, lives - 1);
    updateLivesUI();
    flashDanger();
  } else {
    score++;
    itemCounts[type.id] = (itemCounts[type.id] || 0) + 1;
    updateScoreUI();
  }
  showSpeech(type.text);

  if (lives <= 0 && gameActive) {
    gameActive = false;
    setTimeout(triggerGameOver, 1500);
  } else if (!type.bad && !plot2Unlocked && checkWin() && gameActive) {
    plot2Unlocked = true;
    // poczekaj aż dymek zebranego przedmiotu zniknie, dopiero potem seria kwestii Janusza
    setTimeout(playUnlockSequence, 1800);
  }
}

function triggerGameOver() {
  document.getElementById('final-score').textContent = score;
  document.getElementById('gameover-screen').classList.remove('hidden');
  hudEl.classList.add('hidden');
}

function startGame() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  hudEl.classList.remove('hidden');

  score = 0;
  lives = 3;
  itemCounts = {};
  plot2Unlocked = false;
  gateOpen = false;
  gateGroup.visible = true;
  dialogueActive = false;
  dialogueQueue = [];
  dialogueOnComplete = null;
  dialogueModalEl.classList.add('hidden');
  updateScoreUI();
  updateLivesUI();

  tractor.position.set(0, 0, 10);
  tractor.rotation.y = 0;
  speed = 0;

  clearItems();
  goodQueue = shuffle(
    GOOD_TYPES.flatMap((t) => [t, t])
  );
  gameActive = true;
  for (let i = 0; i < MAX_ITEMS; i++) spawnItem();

  playIntro();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (gameActive) {
    updateTractor(dt);
    updateItems(dt, t);
  }
  updateCamera();
  renderer.render(scene, camera);
}
animate();
