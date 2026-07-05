export type GamePhase = "menu" | "playing" | "gameover";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Boat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  width: number;
  height: number;
  carrying: number; // how many survivors on board
  maxCarry: number;
}

export interface Survivor {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobOffset: number; // phase for wave bob animation
  rescued: boolean;
  panicking: boolean; // flails faster when shark nearby
  waveTimer: number;  // arms-waving anim timer
}

export interface Shark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  targetId: number | null; // survivor id being chased
  attackTimer: number;
}

export interface Debris {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0-1
  maxLife: number;
  color: string;
  radius: number;
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  lives: number;
  wave: number;
  boat: Boat;
  survivors: Survivor[];
  sharks: Shark[];
  debris: Debris[];
  particles: Particle[];
  safeZone: SafeZone;
  waveTimer: number;       // countdown until next wave
  survivorsRescued: number;
  survivorsLost: number;
  nextId: number;
  combo: number;
  comboTimer: number;
  shakeTimer: number;
  shakeIntensity: number;
  fuelTimer: number;       // time since last rescue (for fuel depletion feel)
}
