import { GameState, Boat, Survivor, Shark, Debris, Particle } from "../types";
import { clamp, dist, randomInRange } from "./canvas";

const BOAT_SPEED = 220;
const BOAT_ACCEL = 600;
const BOAT_FRICTION = 0.88;
const SURVIVOR_DRIFT = 18;
const SHARK_BASE_SPEED = 70;
const SHARK_CHASE_SPEED = 140;
const RESCUE_RADIUS = 36;
const SHARK_EAT_RADIUS = 22;
const BOAT_SHARK_RADIUS = 30;
const DEBRIS_RADIUS_MIN = 10;
const DEBRIS_RADIUS_MAX = 22;

export function makeInitialState(cw: number, ch: number): GameState {
  const safeZone = { x: cw * 0.5, y: ch - 60, radius: 70 };
  return {
    phase: "menu",
    score: 0,
    lives: 3,
    wave: 1,
    boat: makeBoat(cw, ch),
    survivors: [],
    sharks: [],
    debris: [],
    particles: [],
    safeZone,
    waveTimer: 0,
    survivorsRescued: 0,
    survivorsLost: 0,
    nextId: 1,
    combo: 0,
    comboTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    fuelTimer: 0,
  };
}

export function makeBoat(cw: number, ch: number): Boat {
  return {
    x: cw * 0.5,
    y: ch - 100,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    width: 44,
    height: 22,
    carrying: 0,
    maxCarry: 4,
  };
}

let _nextId = 100;
function nextId() { return ++_nextId; }

export function spawnWave(state: GameState, cw: number, ch: number): void {
  const wave = state.wave;
  const survivorCount = 3 + wave;
  const sharkCount = Math.min(1 + Math.floor(wave / 2), 6);
  const debrisCount = Math.min(wave, 8);

  for (let i = 0; i < survivorCount; i++) {
    state.survivors.push(makeSurvivor(cw, ch, state));
  }
  for (let i = 0; i < sharkCount; i++) {
    state.sharks.push(makeShark(cw, ch));
  }
  for (let i = 0; i < debrisCount; i++) {
    state.debris.push(makeDebris(cw, ch));
  }
}

function makeSurvivor(cw: number, ch: number, state: GameState): Survivor {
  const margin = 60;
  const safeY = ch - 120; // keep away from dock
  return {
    id: nextId(),
    x: randomInRange(margin, cw - margin),
    y: randomInRange(margin, safeY * 0.7),
    vx: randomInRange(-SURVIVOR_DRIFT, SURVIVOR_DRIFT),
    vy: randomInRange(-SURVIVOR_DRIFT, SURVIVOR_DRIFT),
    bobOffset: Math.random() * Math.PI * 2,
    rescued: false,
    panicking: false,
    waveTimer: Math.random() * 2,
  };
}

function makeShark(cw: number, ch: number): Shark {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (side === 0) { x = randomInRange(0, cw); y = -30; }
  else if (side === 1) { x = cw + 30; y = randomInRange(0, ch); }
  else if (side === 2) { x = randomInRange(0, cw); y = ch + 30; }
  else { x = -30; y = randomInRange(0, ch); }
  return {
    id: nextId(),
    x, y,
    vx: 0, vy: 0,
    angle: Math.random() * Math.PI * 2,
    speed: SHARK_BASE_SPEED + randomInRange(0, 30),
    targetId: null,
    attackTimer: 0,
  };
}

function makeDebris(cw: number, ch: number): Debris {
  return {
    id: nextId(),
    x: randomInRange(20, cw - 20),
    y: randomInRange(20, ch * 0.75),
    vx: randomInRange(-25, 25),
    vy: randomInRange(-25, 25),
    radius: randomInRange(DEBRIS_RADIUS_MIN, DEBRIS_RADIUS_MAX),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: randomInRange(-1.5, 1.5),
  };
}

export function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 80,
): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spd = speed * (0.5 + Math.random());
    state.particles.push({
      id: nextId(),
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      maxLife: 0.6 + Math.random() * 0.4,
      color,
      radius: 3 + Math.random() * 4,
    });
  }
}

export function updateGame(
  state: GameState,
  dt: number,
  cw: number,
  ch: number,
  inputDx: number,
  inputDy: number,
): void {
  if (state.phase !== "playing") return;

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer <= 0) state.combo = 0;

  state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  state.fuelTimer += dt;

  // --- Boat movement ---
  const boat = state.boat;
  const len = Math.sqrt(inputDx * inputDx + inputDy * inputDy);
  if (len > 0) {
    const nx = inputDx / len;
    const ny = inputDy / len;
    boat.vx += nx * BOAT_ACCEL * dt;
    boat.vy += ny * BOAT_ACCEL * dt;
    boat.angle = Math.atan2(ny, nx);
  }

  const speed = Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
  if (speed > BOAT_SPEED) {
    boat.vx = (boat.vx / speed) * BOAT_SPEED;
    boat.vy = (boat.vy / speed) * BOAT_SPEED;
  }
  boat.vx *= Math.pow(BOAT_FRICTION, dt * 60);
  boat.vy *= Math.pow(BOAT_FRICTION, dt * 60);

  boat.x = clamp(boat.x + boat.vx * dt, boat.width / 2, cw - boat.width / 2);
  boat.y = clamp(boat.y + boat.vy * dt, boat.height / 2, ch - boat.height / 2);

  // --- Survivors ---
  for (const s of state.survivors) {
    if (s.rescued) continue;
    s.waveTimer += dt;
    // Gentle drift + wall bounce
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < 20 || s.x > cw - 20) s.vx *= -1;
    if (s.y < 20 || s.y > ch - 80) s.vy *= -1;
    s.x = clamp(s.x, 20, cw - 20);
    s.y = clamp(s.y, 20, ch - 80);

    // Panic if shark nearby
    let nearShark = false;
    for (const sh of state.sharks) {
      if (dist(s.x, s.y, sh.x, sh.y) < 100) { nearShark = true; break; }
    }
    s.panicking = nearShark;
    if (nearShark) {
      // Swim away from nearest shark
      let closestSh = state.sharks[0];
      let minD = Infinity;
      for (const sh of state.sharks) {
        const d = dist(s.x, s.y, sh.x, sh.y);
        if (d < minD) { minD = d; closestSh = sh; }
      }
      if (closestSh) {
        const dx = s.x - closestSh.x;
        const dy = s.y - closestSh.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        s.vx += (dx / d) * 60 * dt;
        s.vy += (dy / d) * 60 * dt;
      }
    }
  }

  // --- Sharks ---
  for (const sh of state.sharks) {
    sh.attackTimer = Math.max(0, sh.attackTimer - dt);

    // Find nearest survivor to target
    let minD = Infinity;
    sh.targetId = null;
    for (const s of state.survivors) {
      if (s.rescued) continue;
      const d = dist(sh.x, sh.y, s.x, s.y);
      if (d < minD) { minD = d; sh.targetId = s.id; }
    }

    const target = sh.targetId !== null
      ? state.survivors.find(s => s.id === sh.targetId)
      : null;

    if (target && !target.rescued) {
      const dx = target.x - sh.x;
      const dy = target.y - sh.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = sh.speed * (minD < 150 ? SHARK_CHASE_SPEED / SHARK_BASE_SPEED : 1);
      sh.vx += (dx / d) * spd * dt * 4;
      sh.vy += (dy / d) * spd * dt * 4;
      sh.angle = Math.atan2(dy, dx);
    } else {
      // Patrol
      sh.angle += randomInRange(-0.5, 0.5) * dt * 3;
      sh.vx += Math.cos(sh.angle) * sh.speed * dt;
      sh.vy += Math.sin(sh.angle) * sh.speed * dt;
    }

    const shSpd = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy);
    const maxSpd = sh.speed * 1.5;
    if (shSpd > maxSpd) {
      sh.vx = (sh.vx / shSpd) * maxSpd;
      sh.vy = (sh.vy / shSpd) * maxSpd;
    }
    sh.vx *= Math.pow(0.92, dt * 60);
    sh.vy *= Math.pow(0.92, dt * 60);
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;

    // Wrap around edges
    if (sh.x < -50) sh.x = cw + 40;
    if (sh.x > cw + 50) sh.x = -40;
    if (sh.y < -50) sh.y = ch + 40;
    if (sh.y > ch + 50) sh.y = -40;

    // Shark eats survivor
    if (sh.attackTimer <= 0) {
      for (const s of state.survivors) {
        if (s.rescued) continue;
        if (dist(sh.x, sh.y, s.x, s.y) < SHARK_EAT_RADIUS) {
          s.rescued = true; // mark removed
          state.survivorsLost++;
          state.score = Math.max(0, state.score - 50);
          state.lives = Math.max(0, state.lives - 1);
          sh.attackTimer = 2;
          state.shakeTimer = 0.4;
          state.shakeIntensity = 6;
          spawnParticles(state, s.x, s.y, "#ef4444", 12, 100);
          if (state.lives <= 0) {
            state.phase = "gameover";
          }
          break;
        }
      }
    }

    // Shark hits boat
    if (dist(sh.x, sh.y, boat.x, boat.y) < BOAT_SHARK_RADIUS + 10) {
      if (sh.attackTimer <= 0) {
        state.lives = Math.max(0, state.lives - 1);
        sh.attackTimer = 3;
        state.shakeTimer = 0.5;
        state.shakeIntensity = 8;
        // Drop survivors
        boat.carrying = 0;
        spawnParticles(state, boat.x, boat.y, "#f97316", 16, 120);
        if (state.lives <= 0) state.phase = "gameover";
      }
    }
  }

  // --- Debris ---
  for (const d of state.debris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rotation += d.rotSpeed * dt;
    if (d.x < -40) d.x = cw + 30;
    if (d.x > cw + 40) d.x = -30;
    if (d.y < -40) d.y = ch + 30;
    if (d.y > ch + 40) d.y = -30;

    // Debris hits boat
    if (dist(d.x, d.y, boat.x, boat.y) < d.radius + 18) {
      // Bounce
      const dx = boat.x - d.x;
      const dy = boat.y - d.y;
      const dd = Math.sqrt(dx * dx + dy * dy) || 1;
      boat.vx += (dx / dd) * 80;
      boat.vy += (dy / dd) * 80;
      d.vx -= (dx / dd) * 60;
      d.vy -= (dy / dd) * 60;
      state.shakeTimer = 0.15;
      state.shakeIntensity = 3;
    }
  }

  // --- Rescue survivors ---
  for (const s of state.survivors) {
    if (s.rescued) continue;
    if (boat.carrying < boat.maxCarry && dist(boat.x, boat.y, s.x, s.y) < RESCUE_RADIUS) {
      s.rescued = true;
      boat.carrying++;
      spawnParticles(state, s.x, s.y, "#22d3ee", 8, 60);
    }
  }

  // --- Drop off at safe zone ---
  const sz = state.safeZone;
  if (boat.carrying > 0 && dist(boat.x, boat.y, sz.x, sz.y) < sz.radius) {
    const rescued = boat.carrying;
    state.combo++;
    state.comboTimer = 4;
    const pts = rescued * 100 * Math.max(1, state.combo);
    state.score += pts;
    state.survivorsRescued += rescued;
    boat.carrying = 0;
    state.fuelTimer = 0;
    spawnParticles(state, sz.x, sz.y, "#4ade80", 20, 90);
  }

  // --- Particles ---
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.85, dt * 60);
    p.vy *= Math.pow(0.85, dt * 60);
    p.life -= dt / p.maxLife;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  // --- Check wave clear ---
  const alive = state.survivors.filter(s => !s.rescued);
  if (alive.length === 0 && state.survivors.length > 0) {
    // All survivors rescued or eaten — next wave
    state.wave++;
    state.survivors = [];
    state.sharks = [];
    state.debris = [];
    boat.carrying = 0;
    spawnWave(state, cw, ch);
    state.score += state.wave * 200;
  }
}
