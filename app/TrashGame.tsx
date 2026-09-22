"use client";

// Trash-can catching mini-game, opened by double-clicking the desktop Trash
// icon. Self-contained: page.tsx only needs to render <TrashGame onClose={...} />
// when it wants the game window open — everything else (state, game loop,
// UI) lives here.

import { useCallback, useEffect, useRef, useState } from "react";
import { Window, Dialog, Button } from "@liiift-studio/mac-os9-ui";

// ─── Tweak these to change how the game plays ──────────────────────────────
const CONFIG = {
  // Play-area dimensions in px (fixed size, not responsive)
  GAME_WIDTH: 380,
  GAME_HEIGHT: 330,

  // The trash bin the player drags
  BIN_WIDTH: 64,
  BIN_HEIGHT: 50,

  // Falling items
  ITEM_SIZE: 34,
  ITEM_ICONS: [
    "/folder.png",
    "/readme-icon.png",
    "/resume-icon.png",
    "/mail-icon.png",
    "/internet-location.png",
    "/huggingface-icon.png",
    "/finder.png",
    "/printer.png",
  ],

  SPAWN_INTERVAL_MS: 900, // time between items spawning
  FALL_SPEED_MIN: 90, // px/sec, slowest item at the start
  FALL_SPEED_MAX: 170, // px/sec, fastest item at the start
  SPEED_RAMP_PER_CATCH: 4, // px/sec added to min & max speed per successful catch

  CATCHES_TO_WIN: 15, // catches needed to "fill" the bin and win
  LIVES: 3, // misses allowed before game over
};
// ────────────────────────────────────────────────────────────────────────

type FallingItem = {
  id: number;
  x: number;
  y: number;
  speed: number;
  icon: string;
};

type GameStatus = "playing" | "won" | "lost";

let nextItemId = 0;

function spawnItem(catchesSoFar: number): FallingItem {
  const ramp = CONFIG.SPEED_RAMP_PER_CATCH * catchesSoFar;
  const min = CONFIG.FALL_SPEED_MIN + ramp;
  const max = CONFIG.FALL_SPEED_MAX + ramp;
  return {
    id: nextItemId++,
    x: Math.random() * (CONFIG.GAME_WIDTH - CONFIG.ITEM_SIZE),
    y: -CONFIG.ITEM_SIZE,
    speed: min + Math.random() * (max - min),
    icon: CONFIG.ITEM_ICONS[Math.floor(Math.random() * CONFIG.ITEM_ICONS.length)],
  };
}

// Minimal draggable title bar with a text "x" close button (the package's
// default title bar close box has no visible glyph). Implements its own drag
// handling — same trick as elsewhere in this app — since providing a custom
// titleBar replaces Window's built-in title-bar drag behavior.
function GameTitleBar({
  title,
  onPositionChange,
  onClose,
}: {
  title: string;
  onPositionChange: (p: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const windowEl = (e.currentTarget as HTMLElement).parentElement;
    if (!windowEl) return;
    const parent = windowEl.offsetParent as HTMLElement | null;
    const pr = parent ? parent.getBoundingClientRect() : { left: 0, top: 0, width: 1 };
    const scale = parent ? pr.width / parent.offsetWidth : 1;
    const grabX = (e.clientX - pr.left) / scale - windowEl.offsetLeft;
    const grabY = (e.clientY - pr.top) / scale - windowEl.offsetTop;
    const onMove = (me: MouseEvent) => {
      const pr2 = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
      onPositionChange({
        x: (me.clientX - pr2.left) / scale - grabX,
        y: (me.clientY - pr2.top) / scale - grabY,
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#CBCBCB", borderBottom: "1px solid black",
        minHeight: 22, padding: "0 8px", cursor: "grab", userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        title="Close"
        style={{
          width: 14, height: 14, padding: 0, flexShrink: 0,
          fontSize: 10, lineHeight: 1, fontWeight: 700, color: "#1a1a1a",
          background: "transparent", border: "1px solid #1a1a1a", cursor: "pointer",
          boxShadow: "inset -1px -1px 0 rgba(255,255,255,0.7), inset 1px 1px 0 rgba(0,0,0,0.25)",
        }}
      >
        x
      </button>
      <div style={{
        flex: 1, textAlign: "center",
        fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {title}
      </div>
      <div style={{ width: 14, flexShrink: 0 }} aria-hidden />
    </div>
  );
}

export function TrashGame({ onClose }: { onClose: () => void }) {
  const [position, setPosition] = useState({ x: 160, y: 50 });
  const [items, setItems] = useState<FallingItem[]>([]);
  const [binX, setBinX] = useState((CONFIG.GAME_WIDTH - CONFIG.BIN_WIDTH) / 2);
  const [catches, setCatches] = useState(0);
  const [lives, setLives] = useState(CONFIG.LIVES);
  const [status, setStatus] = useState<GameStatus>("playing");

  const playAreaRef = useRef<HTMLDivElement>(null);
  const binXRef = useRef(binX);
  const catchesRef = useRef(catches);
  const itemsRef = useRef<FallingItem[]>(items);
  const spawnTimerRef = useRef(0);

  useEffect(() => { binXRef.current = binX; }, [binX]);
  useEffect(() => { catchesRef.current = catches; }, [catches]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const resetGame = useCallback(() => {
    setItems([]);
    setBinX((CONFIG.GAME_WIDTH - CONFIG.BIN_WIDTH) / 2);
    setCatches(0);
    setLives(CONFIG.LIVES);
    setStatus("playing");
    spawnTimerRef.current = 0;
  }, []);

  // Main game loop: spawn items, move them down, resolve catch/miss at the bin line.
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    let lastTime: number | null = null;

    const tick = (time: number) => {
      if (lastTime === null) lastTime = time;
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      spawnTimerRef.current += dt * 1000;
      let newItem: FallingItem | null = null;
      if (spawnTimerRef.current >= CONFIG.SPAWN_INTERVAL_MS) {
        spawnTimerRef.current = 0;
        newItem = spawnItem(catchesRef.current);
      }

      // Resolve this frame's movement/catch/miss as plain local computation first
      // (not inside a setState updater) so the side effects — setCatches/setLives —
      // only ever run once per real event, not per React updater re-invocation.
      const source = newItem ? [...itemsRef.current, newItem] : itemsRef.current;
      const binTop = CONFIG.GAME_HEIGHT - CONFIG.BIN_HEIGHT;
      const binLeft = binXRef.current;
      const binRight = binLeft + CONFIG.BIN_WIDTH;
      const remaining: FallingItem[] = [];
      let caughtCount = 0;
      let missedCount = 0;
      for (const item of source) {
        const y = item.y + item.speed * dt;
        const itemLeft = item.x;
        const itemRight = item.x + CONFIG.ITEM_SIZE;
        const itemTop = y;
        const itemBottom = y + CONFIG.ITEM_SIZE;

        // Caught as soon as the item's box overlaps the bin's box at all,
        // checked every frame (not just once at a fixed line).
        const overlapsBin =
          itemLeft < binRight && itemRight > binLeft &&
          itemTop < CONFIG.GAME_HEIGHT && itemBottom > binTop;

        if (overlapsBin) {
          caughtCount++;
        } else if (itemBottom >= CONFIG.GAME_HEIGHT) {
          // Missed only once it has fully fallen out the bottom of the play area.
          missedCount++;
        } else {
          remaining.push({ ...item, y });
        }
      }

      itemsRef.current = remaining;
      setItems(remaining);
      if (caughtCount) setCatches(c => c + caughtCount);
      if (missedCount) setLives(l => Math.max(0, l - missedCount));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  // Win/lose check, separate from the loop so it reacts to state updates immediately.
  useEffect(() => {
    if (status !== "playing") return;
    if (lives <= 0) setStatus("lost");
    else if (catches >= CONFIG.CATCHES_TO_WIN) setStatus("won");
  }, [catches, lives, status]);

  // The bin follows the mouse automatically for as long as the game window is
  // open — no click-and-hold needed. Accounts for the scale transform on the
  // retro-desktop container (same trick as the window title bar drag logic).
  useEffect(() => {
    const onMove = (me: MouseEvent) => {
      const el = playAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scale = rect.width / el.offsetWidth;
      const localX = (me.clientX - rect.left) / scale - CONFIG.BIN_WIDTH / 2;
      setBinX(Math.max(0, Math.min(CONFIG.GAME_WIDTH - CONFIG.BIN_WIDTH, localX)));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <>
      {/* Keep the game window above every other desktop window regardless of
          click-to-focus order. The package sets active windows to z-index:10,
          so anything meaningfully higher (and !important, to beat the class
          order tie) always wins. */}
      <style>{`.trash-game-window { z-index: 999 !important; }`}</style>
      <Window
        className="trash-game-window"
        active
        draggable
        position={position}
        onPositionChange={setPosition}
        width={CONFIG.GAME_WIDTH + 40}
        height={CONFIG.GAME_HEIGHT + 92}
        onClose={onClose}
        titleBar={
          <GameTitleBar title="Empty Trash" onPositionChange={setPosition} onClose={onClose} />
        }
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 10, fontFamily: "var(--font-body-mono)" }}>
          {/* Lives + catch progress */}
          <div style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "space-between", marginBottom: 8, fontSize: 11 }}>
            <div aria-label={`${lives} lives remaining`} style={{ letterSpacing: 2 }}>
              {Array.from({ length: CONFIG.LIVES }).map((_, i) => (
                <span key={i} style={{ color: i < lives ? "#c0392b" : "#ccc" }}>♥</span>
              ))}
            </div>
            <div style={{ color: "#555" }}>
              Caught: {Math.min(catches, CONFIG.CATCHES_TO_WIN)} / {CONFIG.CATCHES_TO_WIN}
            </div>
          </div>

          {/* Fill progress bar */}
          <div style={{ flexShrink: 0, height: 6, border: "1px solid #999", borderRadius: 2, background: "#eee", marginBottom: 8, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (catches / CONFIG.CATCHES_TO_WIN) * 100)}%`,
              background: "#5a9c5a",
              transition: "width 120ms linear",
            }} />
          </div>

          {/* Play area — flexShrink:0 is load-bearing: without it, flexbox will
              quietly squish this shorter than GAME_HEIGHT whenever the column
              doesn't perfectly fit, which desyncs every pixel-based position
              (item/bin coordinates) from what's actually visible. */}
          <div
            ref={playAreaRef}
            style={{
              position: "relative",
              flexShrink: 0,
              width: CONFIG.GAME_WIDTH,
              height: CONFIG.GAME_HEIGHT,
              background: "linear-gradient(180deg, #cfe8f5 0%, #eaf6ff 100%)",
              border: "2px solid #333",
              borderRadius: 3,
              overflow: "hidden",
              imageRendering: "pixelated",
            }}
          >
            {items.map(item => (
              <img
                key={item.id}
                src={item.icon}
                alt=""
                draggable={false}
                width={CONFIG.ITEM_SIZE}
                height={CONFIG.ITEM_SIZE}
                style={{
                  position: "absolute",
                  left: item.x,
                  top: item.y,
                  width: CONFIG.ITEM_SIZE,
                  height: CONFIG.ITEM_SIZE,
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Trash bin — follows the mouse automatically */}
            <img
              src="/trash.png"
              alt="Trash bin"
              draggable={false}
              width={CONFIG.BIN_WIDTH}
              height={CONFIG.BIN_HEIGHT}
              style={{
                position: "absolute",
                left: binX,
                top: CONFIG.GAME_HEIGHT - CONFIG.BIN_HEIGHT,
                width: CONFIG.BIN_WIDTH,
                height: CONFIG.BIN_HEIGHT,
                imageRendering: "pixelated",
                pointerEvents: "none",
              }}
            />
          </div>

          <div style={{ flexShrink: 0, fontSize: 9, color: "#888", marginTop: 6, textAlign: "center" }}>
            Move your mouse to catch what falls.
          </div>
        </div>
      </Window>

      <Dialog
        open={status !== "playing"}
        onClose={resetGame}
        title={status === "won" ? "Trash Full!" : "Game Over"}
        width={260}
      >
        <div style={{ padding: "4px 4px 12px", textAlign: "center", fontFamily: "var(--font-body-mono)", fontSize: 12 }}>
          <p style={{ marginBottom: 14 }}>
            {status === "won"
              ? `Nice!!! you filled the trash in ${catches} catches!`
              : "Out of lives! The trash stayed empty."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Button variant="primary" onClick={resetGame}>Play Again</Button>
            <Button variant="default" onClick={onClose}>Exit</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
