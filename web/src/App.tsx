import { useRef, useEffect, useCallback, useState } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import { useControls } from "./hooks/useControls";
import { GameState } from "./types";
import {
  makeInitialState,
  makeBoat,
  spawnWave,
  updateGame,
} from "./lib/gameLogic";
import {
  renderGame,
  renderHUD,
  renderMenu,
  renderGameOver,
} from "./lib/gameRenderer";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const timeRef = useRef(0);
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore("ocean_rescue_hs");
  const controls = useControls();

  // Touch drag for boat steering
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Resize canvas to fill container
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w;
    canvas.height = h;
    sizeRef.current = { w, h };

    // Reposition safe zone
    const s = stateRef.current;
    if (s) {
      s.safeZone.x = w * 0.5;
      s.safeZone.y = h - 60;
    }
  }, []);

  useEffect(() => {
    const s = makeInitialState(
      window.innerWidth,
      window.innerHeight - 56,
    );
    stateRef.current = s;
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [resize]);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      touchStartRef.current = { x: t.clientX, y: t.clientY };
      touchDirRef.current = { dx: 0, dy: 0 };

      // Tap to start / restart
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === "menu") {
        startGame();
      } else if (s.phase === "gameover") {
        restartGame();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t || !touchStartRef.current) return;
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 4) {
        touchDirRef.current = { dx: dx / len, dy: dy / len };
      }
    };

    const onTouchEnd = () => {
      touchStartRef.current = null;
      touchDirRef.current = { dx: 0, dy: 0 };
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Mouse click to start
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onClick = () => {
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === "menu") startGame();
      else if (s.phase === "gameover") restartGame();
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, []);

  function startGame() {
    const s = stateRef.current;
    if (!s) return;
    s.phase = "playing";
    const { w, h } = sizeRef.current;
    s.boat = makeBoat(w, h);
    spawnWave(s, w, h);
  }

  function restartGame() {
    const { w, h } = sizeRef.current;
    const s = makeInitialState(w, h);
    stateRef.current = s;
    startGame();
  }

  useGameLoop((dt: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    timeRef.current += dt;
    const time = timeRef.current;

    // Input
    let inputDx = 0;
    let inputDy = 0;
    const keys = controls.keys;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) inputDx -= 1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) inputDx += 1;
    if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) inputDy -= 1;
    if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) inputDy += 1;

    // Touch drag
    if (touchDirRef.current.dx !== 0 || touchDirRef.current.dy !== 0) {
      inputDx += touchDirRef.current.dx;
      inputDy += touchDirRef.current.dy;
    }

    // Keyboard start
    if (s.phase === "menu" && (keys.has(" ") || keys.has("Enter"))) {
      startGame();
    }
    if (s.phase === "gameover" && (keys.has(" ") || keys.has("Enter") || keys.has("r") || keys.has("R"))) {
      restartGame();
    }

    // Update
    if (s.phase === "playing") {
      updateGame(s, dt, w, h, inputDx, inputDy);
      if (s.score !== score) {
        setScore(s.score);
        updateHighScore(s.score);
      }
    }

    // Render
    ctx.clearRect(0, 0, w, h);

    if (s.phase === "menu") {
      renderMenu(ctx, w, h, time, highScore);
    } else if (s.phase === "playing") {
      renderGame(ctx, s, w, h, time);
      renderHUD(ctx, s, w, h);
    } else if (s.phase === "gameover") {
      renderGame(ctx, s, w, h, time);
      renderHUD(ctx, s, w, h);
      renderGameOver(ctx, s, w, h, time, highScore);
    }
  });

  return (
    <GameShell topbar={<GameTopbar title="Ocean Rescue" score={score} />}>
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{ background: "#0c4a6e", touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />
      </div>
    </GameShell>
  );
}
