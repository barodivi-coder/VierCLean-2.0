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
const FIELD = 30; // half-size of the playable meadow (x-extent for meadow, and south edge z)

// Plansze (łąka, hala, ujeżdżalnia) sięgają teraz tylko do PLAY_Z_MAX (zamiast
// do FIELD) — powyżej biegnie wydzielona ogrodzeniem droga (ROAD_Z_MIN..ROAD_Z_MAX)
// na całej szerokości świata gry (od wschodniej ściany łąki po zachodnią ścianę ujeżdżalni).
const PLAY_Z_MIN = -FIELD;      // -30, południowa krawędź wszystkich 3 plansz (bez zmian)
const PLAY_Z_MAX = 20;          // nowa, przycięta północna krawędź plansz
const PLAY_Z_CENTER = (PLAY_Z_MIN + PLAY_Z_MAX) / 2;
const PLAY_Z_HALF = (PLAY_Z_MAX - PLAY_Z_MIN) / 2;
const ROAD_Z_MIN = PLAY_Z_MAX;  // 20
const ROAD_Z_MAX = 28;          // zewnętrzna, północna granica całego świata gry

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
  patch.position.set((Math.random() * 2 - 1) * FIELD, 0.02, PLAY_Z_CENTER + (Math.random() * 2 - 1) * PLAY_Z_HALF);
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

function applyWallCollision(prevX, candidateX, wallX, margin, passable) {
  if (passable) return candidateX;
  if (prevX >= wallX && candidateX < wallX + margin) return wallX + margin;
  if (prevX < wallX && candidateX > wallX - margin) return wallX - margin;
  return candidateX;
}

// Jak applyWallCollision, ale ściana istnieje TYLKO w podanym zakresie z
// (poza nim brak kolizji — używane dla wewnętrznych działek, które nie
// sięgają na pas drogi).
function applyWallCollisionZRanged(prevX, candidateX, wallX, margin, z, zMin, zMax) {
  if (z < zMin || z > zMax) return candidateX;
  return applyWallCollision(prevX, candidateX, wallX, margin, false);
}

// Pozioma ściana z dowolną liczbą "okien" bram (przejezdna tylko w ich
// zakresie x, z uwzględnionym marginesem traktora).
function applyGatedHorizontalWall(prevZ, candidateZ, wallZ, margin, x, gates) {
  const passable = gates.some((g) => x >= g.from - margin * 0.3 && x <= g.to + margin * 0.3);
  if (passable) return candidateZ;
  if (prevZ <= wallZ && candidateZ > wallZ - margin) return wallZ - margin;
  if (prevZ > wallZ && candidateZ < wallZ + margin) return wallZ + margin;
  return candidateZ;
}

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

// ---------- Second plot: hala (concrete) + third plot: ujeżdżalnia (sand) ----------
const PLOT2_X_MIN = -90;
const PLOT2_X_MAX = -30; // shared border with the meadow's left fence
const PLOT2_Z_MIN = PLAY_Z_MIN;
const PLOT2_Z_MAX = PLAY_Z_MAX;

// Wewnętrzne ogrodzenie dzieli drugą działkę mniej więcej na pół:
// - PLOT2_DIVIDER_X..PLOT2_X_MAX -> plansza 2 (hala, beton)
// - PLOT2_X_MIN..PLOT2_DIVIDER_X -> plansza 3 (ujeżdżalnia, piasek)
const PLOT2_DIVIDER_X = (PLOT2_X_MIN + PLOT2_X_MAX) / 2; // -60
const PLOT2_CENTER_X = (PLOT2_DIVIDER_X + PLOT2_X_MAX) / 2;
const PLOT3_CENTER_X = (PLOT2_X_MIN + PLOT2_DIVIDER_X) / 2;

// ---------- Plansza 4: nowa działka, wielkości plansza-2, dalej na zachód ----------
const PLOT4_X_MAX = PLOT2_X_MIN;                      // -90, wspólna granica z plansza-3
const PLOT4_X_MIN = PLOT4_X_MAX - (PLOT2_X_MAX - PLOT2_DIVIDER_X); // -120 (ta sama szerokość co plansza-2)
const PLOT4_CENTER_X = (PLOT4_X_MIN + PLOT4_X_MAX) / 2; // -105
// Zachodnia krawędź plansza-4 to teraz prawdziwa granica całego świata gry.
const WORLD_X_MIN = PLOT4_X_MIN;

// Brama 1 (łąka -> droga): w rogu ogrodzenia łąki z halą (przy x = -30).
const GATE_WIDTH = 10;
const GATE1_X_MIN = PLOT2_X_MAX;              // -30
const GATE1_X_MAX = PLOT2_X_MAX + GATE_WIDTH; // -20
// Brama 2 (droga -> ujeżdżalnia): w rogu ogrodzenia ujeżdżalni z halą (przy x = -60).
const GATE2_X_MIN = PLOT2_DIVIDER_X - GATE_WIDTH; // -70
const GATE2_X_MAX = PLOT2_DIVIDER_X;              // -60

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
  tex.repeat.set(4, 8);
  return tex;
}

function makeSandTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#D9BB63';
  ctx.fillRect(0, 0, size, size);
  // delikatne, "zagrabione" faliste pasy jak na piaszczystej ujeżdżalni
  ctx.strokeStyle = 'rgba(150,118,45,0.25)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    const y = i * (size / 9);
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.25, y + 10, size * 0.75, y - 10, size, y);
    ctx.stroke();
  }
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(90,66,20,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 8);
  return tex;
}

function addPlot2Ground() {
  const mat = new THREE.MeshToonMaterial({ map: makeConcreteTexture(), gradientMap: toonGradient });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT2_X_MAX - PLOT2_DIVIDER_X, PLOT2_Z_MAX - PLOT2_Z_MIN),
    mat
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(PLOT2_CENTER_X, 0.01, PLAY_Z_CENTER);
  plane.receiveShadow = true;
  scene.add(plane);
}
addPlot2Ground();

function addPlot3Ground() {
  const mat = new THREE.MeshToonMaterial({ map: makeSandTexture(), gradientMap: toonGradient });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT2_DIVIDER_X - PLOT2_X_MIN, PLOT2_Z_MAX - PLOT2_Z_MIN),
    mat
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(PLOT3_CENTER_X, 0.011, PLAY_Z_CENTER);
  plane.receiveShadow = true;
  scene.add(plane);
}
addPlot3Ground();

function addPlot4Ground() {
  const mat = new THREE.MeshToonMaterial({ map: makeConcreteTexture(), gradientMap: toonGradient });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(PLOT4_X_MAX - PLOT4_X_MIN, PLAY_Z_MAX - PLAY_Z_MIN),
    mat
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(PLOT4_CENTER_X, 0.01, PLAY_Z_CENTER);
  plane.receiveShadow = true;
  scene.add(plane);
}
addPlot4Ground();

// ---------- Dirt road: runs the FULL width of the game world ----------
// Od wschodniej ściany łąki (x = FIELD) po zachodnią ścianę ujeżdżalni
// (x = PLOT2_X_MIN) — jedna, ciągła, ubita droga ziemna nad wszystkimi trzema planszami.
function makeDirtRoadTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8A6A45';
  ctx.fillRect(0, 0, size, size);
  // nieregularne, ciemniejsze i jaśniejsze plamy ubitej ziemi
  for (let i = 0; i < 260; i++) {
    const shade = Math.random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade * 0.8},${shade * 0.55},${0.05 + Math.random() * 0.06})`;
    const r = 8 + Math.random() * 22;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(40,28,15,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 2);
  return tex;
}

function addRoadStrip() {
  const roadWidth = FIELD - WORLD_X_MIN;   // wzdłuż X — cała szerokość świata
  const roadDepth = ROAD_Z_MAX - ROAD_Z_MIN;
  const mat = new THREE.MeshToonMaterial({ map: makeDirtRoadTexture(), gradientMap: toonGradient });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadDepth), mat);
  road.rotation.x = -Math.PI / 2;
  road.position.set((WORLD_X_MIN + FIELD) / 2, 0.015, (ROAD_Z_MIN + ROAD_Z_MAX) / 2);
  road.receiveShadow = true;
  scene.add(road);
}
addRoadStrip();

// Subtelne koleiny od kół (dwa ciemniejsze pasy) zamiast malowanej linii —
// pasują do ubitej drogi ziemnej.
function addRoadWheelRuts() {
  const rutMat = toonMat(0x6B4F30);
  const zC = (ROAD_Z_MIN + ROAD_Z_MAX) / 2;
  const rutWidth = 0.35;
  [-1.4, 1.4].forEach((offset) => {
    const rut = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD - WORLD_X_MIN - 4, rutWidth),
      rutMat
    );
    rut.rotation.x = -Math.PI / 2;
    rut.position.set((WORLD_X_MIN + FIELD) / 2, 0.02, zC + offset);
    scene.add(rut);
  });
}
addRoadWheelRuts();

// ---------- Fencing: outer walls + internal dividers + gated north edge ----------
function addAllFencing() {
  // Zewnętrzne ściany pionowe — pełna wysokość świata (plansze + droga), bez bram.
  buildFenceSegment(FIELD, PLAY_Z_MIN, FIELD, ROAD_Z_MAX);                // wschód (x = +30)
  buildFenceSegment(WORLD_X_MIN, PLAY_Z_MIN, WORLD_X_MIN, ROAD_Z_MAX);    // zachód (x = -120)

  // Południowa krawędź (front wszystkich 4 plansz), bez bram.
  buildFenceSegment(WORLD_X_MIN, PLAY_Z_MIN, FIELD, PLAY_Z_MIN);

  // Zewnętrzna, północna krawędź drogi (prawdziwa granica świata), bez bram.
  buildFenceSegment(WORLD_X_MIN, ROAD_Z_MAX, FIELD, ROAD_Z_MAX);

  // Wewnętrzne działki (łąka|hala, hala|ujeżdżalnia, ujeżdżalnia|plansza-4) —
  // tylko na wysokości plansz (nie wchodzą na drogę), bez bram.
  buildFenceSegment(PLOT2_X_MAX, PLAY_Z_MIN, PLOT2_X_MAX, PLAY_Z_MAX);     // x = -30
  buildFenceSegment(PLOT2_DIVIDER_X, PLAY_Z_MIN, PLOT2_DIVIDER_X, PLAY_Z_MAX); // x = -60
  buildFenceSegment(PLOT4_X_MAX, PLAY_Z_MIN, PLOT4_X_MAX, PLAY_Z_MAX);     // x = -90

  // Granica plansze <-> droga (z = PLAY_Z_MAX):
  // - solidny odcinek na łące (od wschodu do bramy 1)
  // - brama 1, w rogu z halą (x = -30)
  // - CAŁY odcinek nad planszą-2 (halą) BEZ ogrodzenia — trwale otwarty
  // - brama 2, w rogu z halą (x = -60)
  // - solidny odcinek na ujeżdżalni i plansza-4 (na razie bez bramy — tylko wizualnie)
  buildFenceSegment(GATE1_X_MAX, PLAY_Z_MAX, FIELD, PLAY_Z_MAX);                 // -20..30 solidny
  buildFenceSegment(GATE1_X_MIN, PLAY_Z_MAX, GATE1_X_MAX, PLAY_Z_MAX, { from: 0, to: 1 }); // brama 1 (-30..-20)
  // (-60..-30 celowo bez ogrodzenia — hala ma stały, otwarty dostęp z drogi)
  buildFenceSegment(GATE2_X_MIN, PLAY_Z_MAX, GATE2_X_MAX, PLAY_Z_MAX, { from: 0, to: 1 }); // brama 2 (-70..-60)
  buildFenceSegment(WORLD_X_MIN, PLAY_Z_MAX, GATE2_X_MIN, PLAY_Z_MAX);            // -120..-70 solidny
}
addAllFencing();

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
  const plotWidth = PLOT2_Z_MAX - PLOT2_Z_MIN; // 50 (po przycięciu pod drogę)
  const hallLength = plotLen / 3;
  const hallWidth = (plotWidth / 3) * 0.72; // delikatnie węższa niż wcześniej
  const gap = 2.5; // odstęp od ogrodzenia, żeby hala go nie przecinała

  const hall = createArchHall(hallLength, hallWidth, 3.2, 0xB3352A);
  // Obrócona o 90° względem poprzedniej wersji — bez rotacji Y oś długości
  // biegnie teraz wzdłuż Z (równolegle do ogrodzenia łąki), zamiast wgłąb działki.
  // Umieszczona blisko ogrodzenia z łąką, w rejonie dawnego (dolnego) narożnika bramy.
  const hallCenterX = PLOT2_X_MAX - hallWidth / 2 - gap;
  const hallCenterZ = -FIELD + hallLength / 2 + gap + 9; // przesunięta delikatnie w stronę drogi
  hall.position.set(hallCenterX, 0, hallCenterZ);
  scene.add(hall);

  HALL_BOUNDS.xMin = hallCenterX - hallWidth / 2;
  HALL_BOUNDS.xMax = hallCenterX + hallWidth / 2;
}
const HALL_BOUNDS = { xMin: 0, xMax: 0 };
addHall();

// ---------- Okólnik: okrągły wybieg za halą, od strony ujeżdżalni ----------
function buildCircularFence(cx, cz, radius) {
  const postCount = Math.max(12, Math.round((2 * Math.PI * radius) / FENCE_SPACING));
  const pts = [];
  for (let i = 0; i < postCount; i++) {
    const angle = (i / postCount) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius });
  }
  pts.forEach((p) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.7, 8), postMat);
    post.position.set(p.x, 0.85, p.z);
    post.castShadow = true;
    scene.add(post);
  });
  for (let i = 0; i < postCount; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % postCount];
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    [0.55, 1.15].forEach((y) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), railMat);
      rail.position.set((p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2);
      rail.rotation.y = -angle;
      rail.castShadow = true;
      scene.add(rail);
    });
  }
}

function addOkolnik() {
  const radius = 6;
  // za halą (mniejsze x niż jej lewa krawędź), w rogu od strony ujeżdżalni
  // (blisko dzielnika hala|ujeżdżalnia i frontowego ogrodzenia).
  const cx = HALL_BOUNDS.xMin - radius - 2;
  const cz = PLAY_Z_MIN + radius + 2;

  const dirtTex = makeDirtRoadTexture();
  dirtTex.repeat.set(3, 3);
  const mat = new THREE.MeshToonMaterial({ map: dirtTex, gradientMap: toonGradient });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0.012, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  buildCircularFence(cx, cz, radius);
}
addOkolnik();

// ---------- Plansza 4: trójskrzydłowy budynek gospodarczy (żółty, dach dwuspadowy) ----------
// Czysto wizualne — bez kolizji i bez możliwości wjazdu do środka (na razie).
function createGableWing(width, length, wallHeight, pitchDeg, wallColor, roofColor, withDoor) {
  const g = new THREE.Group();
  const halfW = width / 2;
  const pitchRad = THREE.Math.degToRad(pitchDeg);
  const rise = halfW * Math.tan(pitchRad);
  const slopeLength = Math.sqrt(halfW * halfW + rise * rise);

  const wallMat = toonMat(wallColor);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, length), wallMat);
  walls.position.y = wallHeight / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);

  // trójkątne szczyty (wypełnienie pod dachem na obu krótszych bokach)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfW, 0);
  gableShape.lineTo(halfW, 0);
  gableShape.lineTo(0, rise);
  gableShape.lineTo(-halfW, 0);
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  const gableFront = new THREE.Mesh(gableGeo, wallMat);
  gableFront.position.set(0, wallHeight, length / 2);
  gableFront.castShadow = true;
  g.add(gableFront);
  const gableBack = new THREE.Mesh(gableGeo, wallMat);
  gableBack.position.set(0, wallHeight, -length / 2);
  gableBack.rotation.y = Math.PI;
  gableBack.castShadow = true;
  g.add(gableBack);

  // dwuspadowy dach (dwie połacie)
  const roofMat = toonMat(roofColor);
  const roofGeo = new THREE.BoxGeometry(slopeLength, 0.12, length + 0.6);
  const roofLeft = new THREE.Mesh(roofGeo, roofMat);
  roofLeft.position.set(-halfW / 2, wallHeight + rise / 2, 0);
  roofLeft.rotation.z = pitchRad;
  roofLeft.castShadow = true;
  g.add(roofLeft);
  const roofRight = new THREE.Mesh(roofGeo, roofMat);
  roofRight.position.set(halfW / 2, wallHeight + rise / 2, 0);
  roofRight.rotation.z = -pitchRad;
  roofRight.castShadow = true;
  g.add(roofRight);

  // prostokątne drzwi na ścianie od strony drogi
  if (withDoor) {
    const doorW = Math.min(width * 0.55, 3.4);
    const doorH = Math.min(wallHeight * 0.8, 2.8);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), toonMat(0x3B2E22));
    door.position.set(0, doorH / 2, length / 2 + 0.03);
    g.add(door);
  }

  return g;
}

function addFarmBuilding() {
  const hallLengthRef = (PLOT2_X_MAX - PLOT2_X_MIN) / 3; // ta sama długość co hala z plansza-2 (20)
  const hallWidthRef = ((PLAY_Z_MAX - PLAY_Z_MIN) / 3) * 0.72; // aktualna szerokość hali (12)

  const sideWidth = hallWidthRef / 2;   // 6 — boczne, węższe skrzydła
  const midWidth = hallWidthRef;        // 12 — środkowe, szersze skrzydło
  const length = hallLengthRef;         // 20 — ta sama długość co hala
  const pitchDeg = 10;
  const wallHeight = 4;
  const wallColor = 0xE3B23C;   // żółty
  const roofColor = 0xB3352A;   // czerwony

  const building = new THREE.Group();

  const left = createGableWing(sideWidth, length, wallHeight, pitchDeg, wallColor, roofColor, true);
  left.position.x = -(midWidth / 2 + sideWidth / 2);
  building.add(left);

  const middle = createGableWing(midWidth, length, wallHeight, pitchDeg, wallColor, roofColor, true);
  building.add(middle);

  const right = createGableWing(sideWidth, length, wallHeight, pitchDeg, wallColor, roofColor, true);
  right.position.x = midWidth / 2 + sideWidth / 2;
  building.add(right);

  building.position.set(PLOT4_CENTER_X, 0, PLAY_Z_CENTER);
  scene.add(building);
}
addFarmBuilding();

// ---------- Show-jumping obstacles on plansza-3 (ujeżdżalnia) ----------
// obstacles: lista prostokątnych "twardych" stref (AABB) blokujących traktor,
// tak jak ogrodzenie — traktor może je jedynie omijać.
const obstacles = [];
function registerObstacle(x, z, halfW, halfD) {
  obstacles.push({ x, z, halfW, halfD });
}

function createStandard(height, color) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.16), toonMat(0xF7F5EF));
  post.position.y = height / 2;
  post.castShadow = true;
  g.add(post);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.26), toonMat(color));
  cap.position.y = height;
  g.add(cap);
  return g;
}

function createPole(length, color) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 10), toonMat(color));
  pole.rotation.z = Math.PI / 2;
  pole.castShadow = true;
  return pole;
}

// Pojedyncza stacjonata: dwa słupki + jedna pozioma żerdź.
function createVertical(width, height, color) {
  const g = new THREE.Group();
  const left = createStandard(height + 0.25, color);
  left.position.x = -width / 2;
  g.add(left);
  const right = createStandard(height + 0.25, color);
  right.position.x = width / 2;
  g.add(right);
  const pole = createPole(width + 0.3, color);
  pole.position.y = height;
  g.add(pole);
  return g;
}

// Okser: dwie równoległe żerdzie (przód niżej, tył wyżej) tworzące przeszkodę szerokościową.
function createOxer(width, height, spread, color1, color2) {
  const g = new THREE.Group();
  const front = createVertical(width, height * 0.82, color1);
  front.position.z = -spread / 2;
  g.add(front);
  const back = createVertical(width, height, color2);
  back.position.z = spread / 2;
  g.add(back);
  return g;
}

function placeVertical(x, z, width, height, color) {
  const obj = createVertical(width, height, color);
  obj.position.set(x, 0, z);
  scene.add(obj);
  registerObstacle(x, z, width / 2 + 0.4, 0.7);
}

function placeOxer(x, z, width, height, spread, color1, color2) {
  const obj = createOxer(width, height, spread, color1, color2);
  obj.position.set(x, 0, z);
  scene.add(obj);
  registerObstacle(x, z, width / 2 + 0.4, spread / 2 + 0.7);
}

function placeDoubleVertical(x, z, width, height, gap, color1, color2) {
  const g = new THREE.Group();
  const a = createVertical(width, height, color1);
  a.position.z = -gap / 2;
  g.add(a);
  const b = createVertical(width, height, color2);
  b.position.z = gap / 2;
  g.add(b);
  g.position.set(x, 0, z);
  scene.add(g);
  registerObstacle(x, z - gap / 2, width / 2 + 0.4, 0.7);
  registerObstacle(x, z + gap / 2, width / 2 + 0.4, 0.7);
}

function addJumpingObstacles() {
  const JW = 5; // szerokość pojedynczej przeszkody
  // rozstawione wzdłuż ujeżdżalni w paśmie z ∈ [-16,16], z dala od granicy z drogą
  placeVertical(PLOT3_CENTER_X + 6, -16, JW, 1.0, 0xE4572E);
  placeOxer(PLOT3_CENTER_X - 6, -8, JW, 1.0, 1.0, 0xE4572E, 0xFFC145);
  placeDoubleVertical(PLOT3_CENTER_X + 4, 0, JW, 1.0, 7, 0xE4572E, 0x2E7D32);
  placeOxer(PLOT3_CENTER_X - 6, 8, JW, 1.0, 1.0, 0xFFC145, 0xE4572E);
  placeVertical(PLOT3_CENTER_X + 6, 16, JW, 1.0, 0x2E7D32);
}
addJumpingObstacles();

function resolveObstacleCollision(x, z) {
  const R = 1.5; // efektywny promień kolizji traktora
  let px = x, pz = z;
  obstacles.forEach((o) => {
    const closestX = THREE.Math.clamp(px, o.x - o.halfW, o.x + o.halfW);
    const closestZ = THREE.Math.clamp(pz, o.z - o.halfD, o.z + o.halfD);
    const dx = px - closestX, dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < R * R) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const overlap = R - dist;
      px += (dx / dist) * overlap;
      pz += (dz / dist) * overlap;
    }
  });
  return { x: px, z: pz };
}

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

  const M = 2.2; // margines ~ promień traktora

  // Absolutna zewnętrzna granica całego świata gry (plansze + droga).
  newX = THREE.Math.clamp(newX, WORLD_X_MIN + M, FIELD - M);
  newZ = THREE.Math.clamp(newZ, PLAY_Z_MIN + M, ROAD_Z_MAX - M);

  // Wewnętrzne działki (łąka|hala, hala|ujeżdżalnia) — solidne, ale TYLKO na
  // wysokości plansz (z ∈ [PLAY_Z_MIN, PLAY_Z_MAX]); nad drogą znikają, więc
  // jazda wzdłuż drogi jest zawsze swobodna.
  newX = applyWallCollisionZRanged(tractor.position.x, newX, PLOT2_X_MAX, M, newZ, PLAY_Z_MIN, PLAY_Z_MAX);
  newX = applyWallCollisionZRanged(tractor.position.x, newX, PLOT2_DIVIDER_X, M, newZ, PLAY_Z_MIN, PLAY_Z_MAX);
  newX = applyWallCollisionZRanged(tractor.position.x, newX, PLOT4_X_MAX, M, newZ, PLAY_Z_MIN, PLAY_Z_MAX);

  // Granica plansze <-> droga (z = PLAY_Z_MAX): odcinek nad halą jest trwale
  // otwarty (bez ogrodzenia), a bramy 1/2 tylko gdy gracz je otworzył.
  const gateWindows = [{ from: PLOT2_DIVIDER_X, to: PLOT2_X_MAX }]; // hala <-> droga, zawsze
  if (gateOpen) {
    gateWindows.push({ from: GATE1_X_MIN, to: GATE1_X_MAX });
    gateWindows.push({ from: GATE2_X_MIN, to: GATE2_X_MAX });
  }
  newZ = applyGatedHorizontalWall(tractor.position.z, newZ, PLAY_Z_MAX, M, newX, gateWindows);

  const resolved = resolveObstacleCollision(newX, newZ);
  tractor.position.x = resolved.x;
  tractor.position.z = resolved.z;

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

// ---------- Plansza 3 (ujeżdżalnia) — zupełnie nowe dobre przedmioty ----------
// Złe przedmioty pozostają te same co na planszy 1 (koty z BAD_TYPES).
const ARENA_GOOD_TYPES = [
  { id: 'bone', bad: false, emoji: '🦴', text: 'Pan Janusz: Kostkę damy Madzi, niech weźmie do schronu' },
  { id: 'icecream', bad: false, emoji: '🍦', text: 'Pan Janusz: Mmm lody w sam raz na wieczór hawajski' },
  { id: 'chain', bad: false, emoji: '⛓️', text: 'Pan Janusz: Łańcuch przyda się jak znowu zerwą huśtawkę' },
  { id: 'bull', bad: false, emoji: '🐂', text: 'Pan Janusz: Zaabiłeem byyyka... Cóż to dla mnie byk! Lalala' },
  { id: 'creamcake', bad: false, emoji: '🎂', text: 'Pan Janusz: Ciasto z masą! Od razu do buzi!' }
];
const ARENA_GOOD_SLOTS = 3;
const ARENA_BAD_SLOTS = 3;
const ARENA_MAX_ITEMS = ARENA_GOOD_SLOTS + ARENA_BAD_SLOTS;

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
    PLAY_Z_CENTER + (Math.random() * 2 - 1) * (PLAY_Z_HALF - margin)
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

// ---------- Plansza 3 (ujeżdżalnia) — osobna pula aktywnych przedmiotów ----------
const arenaActiveItems = [];
let arenaGoodQueue = [];
let arenaStarted = false; // czy gracz już wjechał na planszę 3 i przedmioty zaczęły się pojawiać

function randomArenaPos() {
  const margin = 4;
  let pos, tries = 0;
  do {
    pos = new THREE.Vector3(
      PLOT2_X_MIN + margin + Math.random() * (PLOT2_DIVIDER_X - PLOT2_X_MIN - margin * 2),
      1.3,
      PLOT2_Z_MIN + margin + Math.random() * (PLOT2_Z_MAX - PLOT2_Z_MIN - margin * 2)
    );
    tries++;
  } while (
    tries < 20 &&
    obstacles.some((o) => Math.abs(pos.x - o.x) < o.halfW + 2 && Math.abs(pos.z - o.z) < o.halfD + 2)
  );
  return pos;
}

function pickNextArenaType() {
  const activeGood = arenaActiveItems.filter((it) => !it.userData.type.bad).length;
  const activeBad = arenaActiveItems.length - activeGood;
  if (activeGood <= activeBad && arenaGoodQueue.length > 0) {
    return arenaGoodQueue.shift();
  }
  return BAD_TYPES[Math.floor(Math.random() * BAD_TYPES.length)];
}

function spawnArenaItem() {
  if (!gameActive || arenaActiveItems.length >= ARENA_MAX_ITEMS) return;
  const type = pickNextArenaType();
  if (!type) return;

  const sprite = makeItemSprite(type);

  let pos, tries = 0;
  do { pos = randomArenaPos(); tries++; } while (pos.distanceTo(tractor.position) < 6 && tries < 12);

  sprite.position.copy(pos);
  sprite.userData = { type, baseY: pos.y };
  scene.add(sprite);
  arenaActiveItems.push(sprite);
}

function clearArenaItems() {
  arenaActiveItems.forEach((it) => scene.remove(it));
  arenaActiveItems.length = 0;
}

function startArenaItems() {
  arenaStarted = true;
  arenaGoodQueue = shuffle(ARENA_GOOD_TYPES.flatMap((t) => [t, t]));
  for (let i = 0; i < ARENA_MAX_ITEMS; i++) spawnArenaItem();
}

function updateArenaItems(dt, t) {
  for (let i = arenaActiveItems.length - 1; i >= 0; i--) {
    const it = arenaActiveItems[i];
    it.position.y = it.userData.baseY + Math.sin(t * 2 + i * 1.3) * 0.15;
    it.material.rotation += dt * 0.4;

    const dist = it.position.distanceTo(tractor.position);
    if (dist < 2.3) {
      handleCollect(it.userData.type);
      scene.remove(it);
      arenaActiveItems.splice(i, 1);
      setTimeout(spawnArenaItem, 500 + Math.random() * 1300);
    }
  }
}

function checkArenaEntry() {
  if (!gameActive || arenaStarted) return;
  // "Pełne" wjechanie na planszę 3 — kawałek za wewnętrzną bramą, żeby
  // przedmioty nie zaczęły się pojawiać dosłownie w progu bramy.
  if (tractor.position.x < PLOT2_DIVIDER_X - 3) {
    startArenaItems();
  }
}

function checkArenaWin() {
  return ARENA_GOOD_TYPES.every((t) => (itemCounts[t.id] || 0) >= WIN_TARGET_PER_ITEM);
}

// ---------- Game state ----------
let score = 0;
let lives = 3;
let gameActive = false;
let speechTimer = null;
let itemCounts = {};
let plot2Unlocked = false;
let arenaCompleted = false;

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
  showDialogueModal(INTRO_LINES);
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
  } else if (!type.bad && arenaStarted && !arenaCompleted && checkArenaWin() && gameActive) {
    arenaCompleted = true;
    gameActive = false;
    setTimeout(triggerVictory, 1800);
  }
}

function triggerGameOver() {
  document.getElementById('final-score').textContent = score;
  document.getElementById('gameover-screen').classList.remove('hidden');
  hudEl.classList.add('hidden');
}

function triggerVictory() {
  document.getElementById('victory-score').textContent = score;
  document.getElementById('victory-screen').classList.remove('hidden');
  hudEl.classList.add('hidden');
}

function startGame() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('victory-screen').classList.add('hidden');
  hudEl.classList.remove('hidden');

  score = 0;
  lives = 3;
  itemCounts = {};
  plot2Unlocked = false;
  arenaStarted = false;
  arenaCompleted = false;
  arenaGoodQueue = [];
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
  clearArenaItems();
  goodQueue = shuffle(
    GOOD_TYPES.flatMap((t) => [t, t])
  );
  gameActive = true;
  for (let i = 0; i < MAX_ITEMS; i++) spawnItem();

  playIntro();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('victory-restart-btn').addEventListener('click', startGame);

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (gameActive) {
    updateTractor(dt);
    updateItems(dt, t);
    checkArenaEntry();
    updateArenaItems(dt, t);
  }
  updateCamera();
  renderer.render(scene, camera);
}
animate();
