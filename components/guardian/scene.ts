// Guardián holográfico: escena 3D procedimental inspirada en el ajolote del
// logo oficial de XIBALBÁ AI. La geometría se construye en código, sin modelos
// externos ni descargas, por lo que no introduce recursos de terceros ni
// problemas de licencia. El logo original no se usa ni se sustituye aquí.

import * as THREE from 'three';

export type GuardianState = 'reposo' | 'escuchando' | 'analizando' | 'explicando' | 'alerta' | 'error';
export type GuardianLight = 'verde' | 'amarillo' | 'rojo' | 'gris';

const SKIN = 0x39414f;
const SKIN_DARK = 0x272d38;
const GOLD = 0xe3b23c;
const CYAN = 0x2ee6e6;
const VIOLET = 0x8b5cf6;

const LIGHT_COLOR: Record<GuardianLight, number> = {
  verde: 0x34d399,
  amarillo: 0xfbbf24,
  rojo: 0xf43f5e,
  gris: 0x2ee6e6,
};

type Pose = {
  yaw: number;
  pitch: number;
  roll: number;
  bob: number;
  bobSpeed: number;
  gillSpeed: number;
  gillSpread: number;
  glow: number;
  scan: number;
  breath: number;
};

const POSE: Record<GuardianState, Pose> = {
  reposo:     { yaw: 0,     pitch: 0.02,  roll: 0,     bob: 0.035, bobSpeed: 0.9, gillSpeed: 0.8, gillSpread: 0,    glow: 1,    scan: 0, breath: 1 },
  escuchando: { yaw: 0,     pitch: -0.10, roll: 0.10,  bob: 0.020, bobSpeed: 1.5, gillSpeed: 1.8, gillSpread: 0.28, glow: 1.35, scan: 0, breath: 1.3 },
  analizando: { yaw: 0,     pitch: 0.04,  roll: 0,     bob: 0.015, bobSpeed: 2.3, gillSpeed: 2.6, gillSpread: 0.14, glow: 1.7,  scan: 1, breath: 1.7 },
  explicando: { yaw: 0,     pitch: -0.04, roll: -0.05, bob: 0.030, bobSpeed: 1.2, gillSpeed: 1.2, gillSpread: 0.10, glow: 1.2,  scan: 0, breath: 1.1 },
  alerta:     { yaw: 0,     pitch: -0.14, roll: 0,     bob: 0.012, bobSpeed: 3.0, gillSpeed: 3.2, gillSpread: 0.40, glow: 2.1,  scan: 0, breath: 2.2 },
  error:      { yaw: 0.10,  pitch: 0.14,  roll: 0.08,  bob: 0.018, bobSpeed: 0.6, gillSpeed: 0.4, gillSpread: -0.12, glow: 0.6, scan: 0, breath: 0.7 },
};

/** Interpolación exponencial estable frente a variaciones de framerate. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export type SceneHandle = {
  setState: (state: GuardianState) => void;
  setLight: (light: GuardianLight) => void;
  setSpeaking: (speaking: boolean) => void;
  setPointer: (x: number, y: number) => void;
  resize: () => void;
  setPaused: (paused: boolean) => void;
  dispose: () => void;
};

export function createGuardianScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean },
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  // Sin mapeo de tonos, el emisivo saturaba a blanco y el personaje perdía
  // el color del semáforo justo cuando más brilla.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.05, 5.5);
  camera.lookAt(0, -0.05, 0);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- Materiales -----------------------------------------------------------
  const skinMaterial = track(
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0.08 }),
  );
  const skinDarkMaterial = track(
    new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.7, metalness: 0.05 }),
  );
  const goldMaterial = track(
    new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.28, metalness: 0.92, emissive: 0x3a2a05 }),
  );
  const eyeMaterial = track(
    new THREE.MeshStandardMaterial({ color: 0x041417, emissive: CYAN, emissiveIntensity: 1.5, roughness: 0.25 }),
  );
  const glyphMaterial = track(
    new THREE.MeshStandardMaterial({ color: 0x08343a, emissive: CYAN, emissiveIntensity: 1.5, roughness: 0.4 }),
  );
  const gillMaterials = [CYAN, 0x4dd4f0, VIOLET].map((color) =>
    track(
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
    ),
  );

  // --- Fondo: escudo maya y anillo de energía -------------------------------
  const backdrop = new THREE.Group();
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0, 1.95);
  shieldShape.lineTo(1.5, 1.3);
  shieldShape.lineTo(1.5, -0.35);
  shieldShape.quadraticCurveTo(1.45, -1.5, 0, -2.15);
  shieldShape.quadraticCurveTo(-1.45, -1.5, -1.5, -0.35);
  shieldShape.lineTo(-1.5, 1.3);
  shieldShape.closePath();
  const shieldMaterial = track(
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  );
  const shield = new THREE.Mesh(track(new THREE.ShapeGeometry(shieldShape)), shieldMaterial);
  shield.position.set(0, 0.1, -1.6);
  shield.scale.setScalar(1.12);
  backdrop.add(shield);

  const ringMaterial = track(
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35 }),
  );
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(1.72, 0.012, 8, 128)), ringMaterial);
  ring.position.set(0, 0.1, -1.5);
  backdrop.add(ring);

  // Anillo de escaneo: solo visible durante el análisis.
  const scanMaterial = track(
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0 }),
  );
  const scanRing = new THREE.Mesh(track(new THREE.TorusGeometry(1.25, 0.02, 8, 96)), scanMaterial);
  scanRing.rotation.x = Math.PI / 2.1;
  scanRing.position.y = -0.9;
  backdrop.add(scanRing);
  scene.add(backdrop);

  // --- Personaje ------------------------------------------------------------
  const guardian = new THREE.Group();
  guardian.position.y = -0.12;
  guardian.scale.setScalar(1.12);
  scene.add(guardian);

  const bodyGroup = new THREE.Group();
  guardian.add(bodyGroup);

  const body = new THREE.Mesh(track(new THREE.SphereGeometry(0.78, 36, 28)), skinMaterial);
  body.scale.set(1, 0.92, 0.86);
  body.position.y = -0.74;
  bodyGroup.add(body);

  const belly = new THREE.Mesh(track(new THREE.SphereGeometry(0.58, 28, 20)), skinDarkMaterial);
  belly.scale.set(1, 0.84, 0.6);
  belly.position.set(0, -0.78, 0.42);
  bodyGroup.add(belly);

  // Glifos luminosos del pecho.
  for (const [x, y, s] of [
    [-0.3, -0.58, 1],
    [0.3, -0.58, 1],
    [0, -0.92, 1.2],
    [-0.42, -1.0, 0.8],
    [0.42, -1.0, 0.8],
  ] as [number, number, number][]) {
    const glyph = new THREE.Mesh(track(new THREE.TorusGeometry(0.07 * s, 0.018, 6, 4)), glyphMaterial);
    glyph.position.set(x, y, 0.62);
    glyph.rotation.z = Math.PI / 4;
    bodyGroup.add(glyph);
  }

  // Brazos y manos.
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.1, 0.3, 6, 12)), skinMaterial);
    upper.rotation.z = side * 0.75;
    upper.position.set(side * 0.2, -0.16, 0);
    arm.add(upper);
    const hand = new THREE.Mesh(track(new THREE.SphereGeometry(0.14, 16, 12)), skinMaterial);
    hand.position.set(side * 0.38, -0.34, 0.08);
    arm.add(hand);
    arm.position.set(side * 0.52, -0.52, 0.38);
    arms.push(arm);
    bodyGroup.add(arm);
  }

  // Cabeza.
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.2;
  guardian.add(headPivot);

  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.92, 40, 32)), skinMaterial);
  head.scale.set(1.16, 0.95, 1);
  headPivot.add(head);

  const snoutMaterial = track(
    new THREE.MeshStandardMaterial({ color: 0x4a5464, roughness: 0.6, metalness: 0.06 }),
  );
  const snout = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 24, 18)), snoutMaterial);
  snout.scale.set(1.18, 0.72, 0.9);
  snout.position.set(0, -0.3, 0.72);
  headPivot.add(snout);

  // Boca: un arco sutil que sugiere la sonrisa del logo.
  const mouth = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.2, 0.022, 6, 26, Math.PI * 0.8)),
    skinDarkMaterial,
  );
  mouth.position.set(0, -0.3, 1.0);
  mouth.rotation.set(0.25, 0, Math.PI);
  headPivot.add(mouth);

  // Ojos luminosos, inclinados como en el logo. El párpado es la escala en Y.
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(track(new THREE.SphereGeometry(0.17, 22, 16)), eyeMaterial);
    eye.scale.set(1.12, 0.72, 0.5);
    eye.position.set(side * 0.44, 0.1, 0.82);
    eye.rotation.z = side * -0.24;
    headPivot.add(eye);
    eyes.push(eye);

    // Reborde oscuro que recorta el ojo y evita que se lea como una mancha.
    const socket = new THREE.Mesh(track(new THREE.TorusGeometry(0.23, 0.035, 8, 22)), skinDarkMaterial);
    socket.position.set(side * 0.44, 0.1, 0.8);
    socket.rotation.z = side * -0.24;
    socket.scale.set(1.15, 0.78, 1);
    headPivot.add(socket);
  }

  // Diadema maya dorada con bloques de glifos.
  const bandGroup = new THREE.Group();
  bandGroup.position.y = 0.33;
  bandGroup.rotation.x = -0.1;
  headPivot.add(bandGroup);
  const band = new THREE.Mesh(track(new THREE.TorusGeometry(0.84, 0.095, 12, 48)), goldMaterial);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.15, 1, 0.96);
  bandGroup.add(band);
  for (let i = 0; i < 7; i += 1) {
    const angle = -Math.PI * 0.42 + (i / 6) * Math.PI * 0.84;
    const block = new THREE.Mesh(track(new THREE.BoxGeometry(0.19, 0.19, 0.11)), goldMaterial);
    block.position.set(Math.sin(angle) * 0.97, 0.01, Math.cos(angle) * 0.82);
    block.rotation.y = angle;
    bandGroup.add(block);
  }
  // Colgantes laterales de la diadema.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i += 1) {
      const pendant = new THREE.Mesh(track(new THREE.BoxGeometry(0.15, 0.15, 0.08)), goldMaterial);
      pendant.position.set(side * 1.0, -0.22 - i * 0.2, 0.42);
      pendant.rotation.y = side * 0.5;
      headPivot.add(pendant);
    }
  }

  // Branquias: tres frondas por lado, con pivote propio para ondular.
  const gills: { pivot: THREE.Group; phase: number; base: number; side: number }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.9, 0.36 - i * 0.3, 0.02);
      // Abanico: la fronda superior apunta arriba y afuera, las de abajo
      // se abren más hacia los lados, como las branquias del logo.
      // El giro en Z lleva +Y hacia -X, así que el lado derecho necesita
      // ángulo negativo para abrirse hacia fuera y no hundirse en la cabeza.
      const base = -side * (0.62 + i * 0.4);
      pivot.rotation.z = base;
      pivot.rotation.y = side * 0.55;

      const frond = new THREE.Mesh(track(new THREE.ConeGeometry(0.21, 1.35, 10, 1, true)), gillMaterials[i]);
      frond.scale.set(1, 1, 0.3);
      frond.position.y = 0.66;
      pivot.add(frond);

      const tip = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 10, 8)), gillMaterials[i]);
      tip.position.y = 1.3;
      pivot.add(tip);

      headPivot.add(pivot);
      gills.push({ pivot, phase: i * 0.7 + (side > 0 ? 1.4 : 0), base, side });
    }
  }

  // --- Luces ----------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x1a1030, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(2.4, 3.2, 3.4);
  scene.add(key);
  // Relleno frontal: sin él la cara quedaba casi negra sobre el fondo oscuro.
  const fill = new THREE.DirectionalLight(0xcfe6ff, 0.85);
  fill.position.set(-1.6, 0.8, 3.2);
  scene.add(fill);
  const rim = new THREE.PointLight(CYAN, 14, 14, 2);
  rim.position.set(-2.2, 1.4, -2.2);
  scene.add(rim);
  const warm = new THREE.PointLight(GOLD, 6, 12, 2);
  warm.position.set(2.2, -0.6, 2.2);
  scene.add(warm);
  const aura = new THREE.PointLight(CYAN, 8, 10, 2);
  aura.position.set(0, 0.2, 1.8);
  scene.add(aura);

  // --- Estado de animación --------------------------------------------------
  let state: GuardianState = 'reposo';
  let light: GuardianLight = 'gris';
  let speaking = false;
  let paused = false;
  const pointer = { x: 0, y: 0 };
  const current: Pose = { ...POSE.reposo };
  const accentColor = new THREE.Color(LIGHT_COLOR.gris);
  const targetAccent = new THREE.Color(LIGHT_COLOR.gris);

  let time = 0;
  let blinkTimer = 2 + Math.random() * 3;
  let blink = 0;

  function applyAccent() {
    targetAccent.setHex(LIGHT_COLOR[light]);
  }

  function frame(dt: number) {
    time += dt;
    const target = POSE[state];
    const lambda = 3.2;
    current.yaw = damp(current.yaw, target.yaw, lambda, dt);
    current.pitch = damp(current.pitch, target.pitch, lambda, dt);
    current.roll = damp(current.roll, target.roll, lambda, dt);
    current.bob = damp(current.bob, target.bob, lambda, dt);
    current.bobSpeed = damp(current.bobSpeed, target.bobSpeed, lambda, dt);
    current.gillSpeed = damp(current.gillSpeed, target.gillSpeed, lambda, dt);
    current.gillSpread = damp(current.gillSpread, target.gillSpread, lambda, dt);
    current.glow = damp(current.glow, target.glow, lambda, dt);
    current.scan = damp(current.scan, target.scan, lambda, dt);
    current.breath = damp(current.breath, target.breath, lambda, dt);
    accentColor.lerp(targetAccent, 1 - Math.exp(-2.5 * dt));

    // Respiración y flotación.
    const breath = Math.sin(time * current.breath * 1.6) * 0.016;
    guardian.position.y = -0.12 + Math.sin(time * current.bobSpeed) * current.bob;
    bodyGroup.scale.set(1 + breath, 1 - breath * 0.6, 1 + breath);

    // La cabeza sigue al puntero y suma la pose del estado.
    const lookYaw = pointer.x * 0.22;
    const lookPitch = pointer.y * 0.14;
    const nod = state === 'explicando' ? Math.sin(time * 2.2) * 0.05 : 0;
    const shake = state === 'alerta' ? Math.sin(time * 7.5) * 0.035 : 0;
    headPivot.rotation.y = damp(headPivot.rotation.y, current.yaw + lookYaw + shake, 6, dt);
    headPivot.rotation.x = damp(headPivot.rotation.x, current.pitch + lookPitch + nod, 6, dt);
    headPivot.rotation.z = damp(headPivot.rotation.z, current.roll, 6, dt);

    // Parpadeo.
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blink = 1;
      blinkTimer = 2.4 + Math.random() * 3.6;
    }
    blink = Math.max(0, blink - dt * 7);
    const lid = 1 - Math.sin(Math.min(blink, 1) * Math.PI) * 0.94;
    for (const eye of eyes) eye.scale.y = lid;

    // Branquias ondulando.
    for (const gill of gills) {
      const wave = Math.sin(time * current.gillSpeed + gill.phase);
      gill.pivot.rotation.z = gill.base - gill.side * (current.gillSpread + wave * 0.1);
      gill.pivot.rotation.x = Math.cos(time * current.gillSpeed * 0.8 + gill.phase) * 0.09;
    }

    // Brazos.
    for (let i = 0; i < arms.length; i += 1) {
      arms[i].rotation.z = Math.sin(time * current.bobSpeed * 0.8 + i) * 0.07;
    }

    // Color y energía según el semáforo.
    const pulse = speaking ? 1 + Math.sin(time * 11) * 0.22 : 1;
    eyeMaterial.emissive.copy(accentColor);
    // Curva sublineal: el estado de alerta debe intensificarse sin saturar a
    // blanco, que es lo que borraba el color del semáforo en los ojos.
    eyeMaterial.emissiveIntensity = 0.7 * (0.55 + 0.45 * current.glow) * pulse;
    glyphMaterial.emissive.copy(accentColor);
    glyphMaterial.emissiveIntensity = 0.85 * current.glow;
    aura.color.copy(accentColor);
    aura.intensity = 6 * current.glow * pulse;
    rim.color.copy(accentColor);
    ringMaterial.color.copy(accentColor);
    ringMaterial.opacity = 0.22 + 0.16 * current.glow;
    shieldMaterial.color.copy(accentColor);
    shieldMaterial.opacity = 0.07 + 0.05 * current.glow;
    ring.rotation.z = time * 0.12;

    // Anillo de escaneo.
    scanMaterial.color.copy(accentColor);
    scanMaterial.opacity = current.scan * 0.5;
    if (current.scan > 0.01) {
      const sweep = (time * 0.65) % 1;
      scanRing.position.y = -1.5 + sweep * 2.6;
      scanRing.scale.setScalar(0.72 + Math.sin(sweep * Math.PI) * 0.5);
    }

    renderer.render(scene, camera);
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Encuadre estable en pantallas estrechas y altas.
    camera.position.z = width < 420 ? 6.5 : 5.5;
    camera.updateProjectionMatrix();
  }

  resize();

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) frame(dt);
  };

  if (options.reducedMotion) {
    // Sin animación continua: una pose estática y repintados solo al cambiar.
    frame(0.016);
  } else {
    raf = requestAnimationFrame(loop);
  }

  const renderOnce = () => {
    if (options.reducedMotion) frame(0.016);
  };

  return {
    setState(next) {
      state = next;
      renderOnce();
    },
    setLight(next) {
      light = next;
      applyAccent();
      renderOnce();
    },
    setSpeaking(next) {
      speaking = next;
    },
    setPointer(x, y) {
      pointer.x = Math.max(-1, Math.min(1, x));
      pointer.y = Math.max(-1, Math.min(1, y));
    },
    resize() {
      resize();
      renderOnce();
    },
    setPaused(next) {
      paused = next;
      if (!paused) last = performance.now();
    },
    dispose() {
      cancelAnimationFrame(raf);
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}
