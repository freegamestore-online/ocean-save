import { GameState } from "../types";
import { drawText, drawGlow, lerp } from "./canvas";

const OCEAN_TOP = "#0ea5e9";
const OCEAN_MID = "#0369a1";
const OCEAN_DEEP = "#1e3a5f";
const FOAM_COLOR = "#e0f2fe";
const SAFE_COLOR = "#4ade80";

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
  time: number,
): void {
  ctx.save();

  // Screen shake
  if (state.shakeTimer > 0) {
    const s = state.shakeIntensity * (state.shakeTimer / 0.5);
    ctx.translate(
      (Math.random() - 0.5) * s * 2,
      (Math.random() - 0.5) * s * 2,
    );
  }

  drawOcean(ctx, cw, ch, time);
  drawWaves(ctx, cw, ch, time);
  drawSafeZone(ctx, state, time);
  drawDebris(ctx, state);
  drawSurvivors(ctx, state, time);
  drawSharks(ctx, state, time);
  drawBoat(ctx, state, time);
  drawParticles(ctx, state);

  ctx.restore();
}

function drawOcean(ctx: CanvasRenderingContext2D, cw: number, ch: number, _time: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, OCEAN_TOP);
  grad.addColorStop(0.5, OCEAN_MID);
  grad.addColorStop(1, OCEAN_DEEP);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
}

function drawWaves(ctx: CanvasRenderingContext2D, cw: number, ch: number, time: number): void {
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let row = 0; row < 6; row++) {
    const y = (ch / 6) * row + 30;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= cw; x += 20) {
      const waveY = y + Math.sin((x / 80) + time * 1.2 + row * 0.7) * 6;
      ctx.lineTo(x, waveY);
    }
    ctx.strokeStyle = FOAM_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSafeZone(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const sz = state.safeZone;
  // Dock platform
  ctx.save();
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.roundRect(sz.x - 80, sz.y - 20, 160, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#b45309";
  ctx.fillRect(sz.x - 75, sz.y - 15, 150, 6);
  ctx.fillRect(sz.x - 75, sz.y + 3, 150, 6);

  // Rescue zone pulse
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.strokeStyle = SAFE_COLOR;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5 + 0.3 * pulse;
  ctx.beginPath();
  ctx.arc(sz.x, sz.y, sz.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.1 + 0.08 * pulse;
  ctx.fillStyle = SAFE_COLOR;
  ctx.beginPath();
  ctx.arc(sz.x, sz.y, sz.radius, 0, Math.PI * 2);
  ctx.fill();

  // Dock sign
  ctx.globalAlpha = 1;
  drawText(ctx, "⚓ RESCUE DOCK", sz.x, sz.y - 38, {
    font: "bold 13px Manrope, sans-serif",
    color: "#fef3c7",
    align: "center",
    shadow: "#000",
    shadowBlur: 4,
  });

  // Survivors rescued count
  if (state.survivorsRescued > 0) {
    drawText(ctx, `${state.survivorsRescued} saved`, sz.x, sz.y + 10, {
      font: "bold 12px Manrope, sans-serif",
      color: "#bbf7d0",
      align: "center",
    });
  }

  ctx.restore();
}

function drawSurvivors(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  for (const s of state.survivors) {
    if (s.rescued) continue;
    const bob = Math.sin(time * 2.5 + s.bobOffset) * 4;
    const px = s.x;
    const py = s.y + bob;

    ctx.save();
    // Glow when panicking
    if (s.panicking) {
      drawGlow(ctx, px, py, 40, "#ef4444");
    }

    // Life ring / floatie
    ctx.beginPath();
    ctx.arc(px, py + 6, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py + 6, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fed7aa";
    ctx.fill();

    // Body
    ctx.fillStyle = s.panicking ? "#fca5a5" : "#fde68a";
    ctx.beginPath();
    ctx.ellipse(px, py, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = "#fcd34d";
    ctx.beginPath();
    ctx.arc(px, py - 14, 7, 0, Math.PI * 2);
    ctx.fill();

    // Arms waving
    const waveAmt = s.panicking ? 1.5 : 0.6;
    const armAngle = Math.sin(time * 5 * waveAmt + s.bobOffset) * 0.8;
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    // Left arm
    ctx.beginPath();
    ctx.moveTo(px - 7, py - 4);
    ctx.lineTo(px - 14, py - 10 - Math.sin(armAngle) * 8);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(px + 7, py - 4);
    ctx.lineTo(px + 14, py - 10 + Math.sin(armAngle) * 8);
    ctx.stroke();

    // SOS bubble if panicking
    if (s.panicking && Math.sin(time * 4 + s.bobOffset) > 0.5) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.roundRect(px - 14, py - 32, 28, 14, 4);
      ctx.fill();
      drawText(ctx, "SOS!", px, py - 25, {
        font: "bold 9px Manrope, sans-serif",
        color: "#ef4444",
        align: "center",
      });
    }

    ctx.restore();
  }
}

function drawSharks(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  for (const sh of state.sharks) {
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.angle);

    // Shadow glow
    drawGlow(ctx, 0, 0, 45, "#1e293b");

    // Body
    const bodyLen = 38;
    const bodyH = 14;
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.ellipse(0, 3, bodyLen / 2 - 4, bodyH / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal fin
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(-4, -bodyH / 2);
    ctx.lineTo(6, -bodyH / 2 - 14);
    ctx.lineTo(14, -bodyH / 2);
    ctx.closePath();
    ctx.fill();

    // Tail fin (oscillates)
    const tailWag = Math.sin(time * 6 + sh.x * 0.1) * 0.3;
    ctx.save();
    ctx.translate(-bodyLen / 2 + 2, 0);
    ctx.rotate(tailWag);
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-14, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Eye
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(bodyLen / 2 - 8, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(bodyLen / 2 - 8, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Teeth
    ctx.fillStyle = "#f8fafc";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bodyLen / 2 - 2 + i * 4, 2);
      ctx.lineTo(bodyLen / 2 + 1 + i * 4, 7);
      ctx.lineTo(bodyLen / 2 + 4 + i * 4, 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawBoat(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const { boat } = state;
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.angle + Math.PI / 2);

  const bob = Math.sin(time * 3) * 2;
  ctx.translate(0, bob);

  // Wake / water trail
  ctx.save();
  ctx.rotate(Math.PI);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.15 - i * 0.04;
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.ellipse(0, 20 + i * 18, 10 + i * 6, 5 + i * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Hull
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.moveTo(0, -boat.height * 1.2);
  ctx.lineTo(boat.width / 2, boat.height / 2);
  ctx.lineTo(-boat.width / 2, boat.height / 2);
  ctx.closePath();
  ctx.fill();

  // Hull stripe
  ctx.fillStyle = "#fca5a5";
  ctx.beginPath();
  ctx.moveTo(0, -boat.height * 0.8);
  ctx.lineTo(boat.width / 3, boat.height / 4);
  ctx.lineTo(-boat.width / 3, boat.height / 4);
  ctx.closePath();
  ctx.fill();

  // Cabin
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(-boat.width / 4, -boat.height / 2, boat.width / 2, boat.height * 0.7, 4);
  ctx.fill();

  // Window
  ctx.fillStyle = "#7dd3fc";
  ctx.beginPath();
  ctx.arc(0, -boat.height / 4, 5, 0, Math.PI * 2);
  ctx.fill();

  // Red cross (medical)
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(-2, -boat.height / 4 - 7, 4, 14);
  ctx.fillRect(-7, -boat.height / 4 - 2, 14, 4);

  // Passengers indicator
  if (boat.carrying > 0) {
    ctx.globalAlpha = 1;
    for (let i = 0; i < boat.carrying; i++) {
      const bx = (i - (boat.carrying - 1) / 2) * 10;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(bx, boat.height / 4 - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.arc(bx, boat.height / 4 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flag
  const flagWave = Math.sin(time * 4) * 0.3;
  ctx.save();
  ctx.translate(0, -boat.height * 1.2);
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(10 + flagWave * 4, -14);
  ctx.lineTo(0, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawDebris(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const d of state.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    ctx.fillStyle = "#92400e";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    // Wooden plank shape
    ctx.beginPath();
    ctx.roundRect(-d.radius, -d.radius / 2.5, d.radius * 2, d.radius / 1.2, 3);
    ctx.fill();
    ctx.stroke();
    // Grain lines
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-d.radius + 4 + i * (d.radius * 0.6), -d.radius / 3);
      ctx.lineTo(-d.radius + 4 + i * (d.radius * 0.6), d.radius / 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  _ch: number,
): void {
  // Lives
  const heartX = 16;
  const heartY = 16;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.globalAlpha = i < state.lives ? 1 : 0.25;
    ctx.font = "22px serif";
    ctx.fillText("❤️", heartX + i * 28, heartY);
    ctx.restore();
  }

  // Wave indicator
  drawText(ctx, `WAVE ${state.wave}`, cw / 2, 22, {
    font: "bold 16px Manrope, sans-serif",
    color: "#f0f9ff",
    align: "center",
    shadow: "#0c4a6e",
    shadowBlur: 6,
  });

  // Combo
  if (state.combo > 1 && state.comboTimer > 0) {
    const alpha = Math.min(1, state.comboTimer / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawText(ctx, `x${state.combo} COMBO!`, cw / 2, 48, {
      font: "bold 20px Fraunces, serif",
      color: "#fbbf24",
      align: "center",
      shadow: "#92400e",
      shadowBlur: 8,
    });
    ctx.restore();
  }

  // Carrying indicator
  const boat = state.boat;
  if (boat.carrying > 0) {
    drawText(ctx, `🚣 ${boat.carrying}/${boat.maxCarry} on board`, cw - 12, 22, {
      font: "bold 13px Manrope, sans-serif",
      color: "#fef3c7",
      align: "right",
      shadow: "#000",
      shadowBlur: 4,
    });
    drawText(ctx, "→ Dock to rescue!", cw - 12, 42, {
      font: "12px Manrope, sans-serif",
      color: "#bbf7d0",
      align: "right",
    });
  }

  // Remaining survivors
  const remaining = state.survivors.filter(s => !s.rescued).length;
  if (remaining > 0) {
    drawText(ctx, `🏊 ${remaining} in water`, 16, 46, {
      font: "13px Manrope, sans-serif",
      color: "#e0f2fe",
      align: "left",
    });
  }
}

export function renderMenu(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  time: number,
  highScore: number,
): void {
  // Animated ocean bg
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, "#0ea5e9");
  grad.addColorStop(1, "#1e3a5f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Wave lines
  ctx.save();
  ctx.globalAlpha = 0.15;
  for (let row = 0; row < 8; row++) {
    const y = (ch / 8) * row + 20;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= cw; x += 20) {
      ctx.lineTo(x, y + Math.sin((x / 80) + time * 1.5 + row * 0.5) * 8);
    }
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // Title
  drawGlow(ctx, cw / 2, ch * 0.28, 120, "#0284c7");
  drawText(ctx, "🌊 OCEAN RESCUE", cw / 2, ch * 0.22, {
    font: `bold ${Math.min(44, cw * 0.09)}px Fraunces, serif`,
    color: "#f0f9ff",
    align: "center",
    shadow: "#0c4a6e",
    shadowBlur: 16,
  });
  drawText(ctx, "Save the survivors before the sharks get them!", cw / 2, ch * 0.32, {
    font: `${Math.min(16, cw * 0.034)}px Manrope, sans-serif`,
    color: "#bae6fd",
    align: "center",
  });

  // Instructions
  const instrY = ch * 0.45;
  const instrFont = `${Math.min(14, cw * 0.03)}px Manrope, sans-serif`;
  const lines = [
    "🎮  WASD / Arrow keys to steer",
    "📱  Tap / drag to move on mobile",
    "🏊  Collect survivors in the water",
    "⚓  Return to dock to rescue them",
    "🦈  Avoid sharks & floating debris",
  ];
  lines.forEach((line, i) => {
    drawText(ctx, line, cw / 2, instrY + i * 30, {
      font: instrFont,
      color: "#e0f2fe",
      align: "center",
    });
  });

  // High score
  if (highScore > 0) {
    drawText(ctx, `🏆 Best: ${highScore}`, cw / 2, ch * 0.82, {
      font: "bold 16px Manrope, sans-serif",
      color: "#fbbf24",
      align: "center",
      shadow: "#78350f",
      shadowBlur: 6,
    });
  }

  // Start button pulse
  const pulse = 0.85 + 0.15 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse;
  drawGlow(ctx, cw / 2, ch * 0.91, 60, "#22d3ee");
  drawText(ctx, "▶  TAP TO START", cw / 2, ch * 0.91, {
    font: `bold ${Math.min(22, cw * 0.048)}px Fraunces, serif`,
    color: "#f0f9ff",
    align: "center",
    shadow: "#0c4a6e",
    shadowBlur: 10,
  });
  ctx.restore();
}

export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cw: number,
  ch: number,
  time: number,
  highScore: number,
): void {
  // Dim overlay
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, cw, ch);

  const cx = cw / 2;
  const cy = ch / 2;

  drawGlow(ctx, cx, cy - 30, 150, "#0284c7");

  drawText(ctx, "GAME OVER", cx, cy - 80, {
    font: `bold ${Math.min(42, cw * 0.09)}px Fraunces, serif`,
    color: "#f87171",
    align: "center",
    shadow: "#7f1d1d",
    shadowBlur: 16,
  });

  drawText(ctx, `Score: ${state.score}`, cx, cy - 30, {
    font: "bold 24px Manrope, sans-serif",
    color: "#f0f9ff",
    align: "center",
  });

  if (state.score >= highScore && state.score > 0) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 4);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawText(ctx, "🏆 NEW HIGH SCORE!", cx, cy + 10, {
      font: "bold 18px Fraunces, serif",
      color: "#fbbf24",
      align: "center",
      shadow: "#92400e",
      shadowBlur: 8,
    });
    ctx.restore();
  } else if (highScore > 0) {
    drawText(ctx, `Best: ${highScore}`, cx, cy + 10, {
      font: "16px Manrope, sans-serif",
      color: "#94a3b8",
      align: "center",
    });
  }

  drawText(ctx, `Wave reached: ${state.wave}`, cx, cy + 42, {
    font: "15px Manrope, sans-serif",
    color: "#bae6fd",
    align: "center",
  });
  drawText(ctx, `Rescued: ${state.survivorsRescued}  Lost: ${state.survivorsLost}`, cx, cy + 66, {
    font: "15px Manrope, sans-serif",
    color: "#bae6fd",
    align: "center",
  });

  const pulse2 = 0.85 + 0.15 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = pulse2;
  drawText(ctx, "▶  TAP TO PLAY AGAIN", cx, cy + 112, {
    font: `bold ${Math.min(20, cw * 0.044)}px Fraunces, serif`,
    color: "#f0f9ff",
    align: "center",
    shadow: "#0c4a6e",
    shadowBlur: 8,
  });
  ctx.restore();
}

export function lerp2(a: number, b: number, t: number): number {
  return lerp(a, b, t);
}
