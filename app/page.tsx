"use client";

import { useState, useEffect, useRef } from "react";
import {
  MenuBar,
  MenuItem,
  Window,
  IconButton,
} from "@liiift-studio/mac-os9-ui";

interface YTPlayer {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  pauseVideo(): void;
  playVideo(): void;
}
type YTWindow = Window & {
  YT?: { Player: new (el: HTMLElement, opts: object) => YTPlayer };
  onYouTubeIframeAPIReady?: () => void;
};

// ─── Monitor frame geometry ───────────────────────────────────────────────────
// desk-full-clean.png is 1718 × 1306.  Change MONITOR_W to resize.
const MONITOR_W = 1200;
const MONITOR_H = Math.round(MONITOR_W * (1306 / 1718)); // 912

// Screen-hole position (percentages of frame) — drives the desktop overlay.
// Tweak if the desktop doesn't align with the physical bezel.
const SCREEN = { left: "20.08%", top: "15.01%", width: "60.42%", height: "58.65%" };

// Screen-hole in absolute px — used for boot-zoom math.
const SCR_L  = Math.round(0.2008 * MONITOR_W); // 241
const SCR_T  = Math.round(0.1501 * MONITOR_H); // 137
const SCR_W  = Math.round(0.6042 * MONITOR_W); // 725
const SCR_H  = Math.round(0.5865 * MONITOR_H); // 535
// Center of screen hole — becomes the zoom transform-origin.
const SCR_CX = SCR_L + SCR_W / 2; // 603.5
const SCR_CY = SCR_T + SCR_H / 2; // 404.5
// Maximized window dimensions (fills the desktop area below the menu bar)
const MAX_W = SCR_W - 10;   // 715
const MAX_H = SCR_H - 55;   // ~480 (accounts for ~45 px menu bar + small margin)
// Collapsed (windowshade) height: title bar min-height 22px + 2px window border
const TITLEBAR_H = 24;

function fmtTime() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function Clock() {
  const [time, setTime] = useState(fmtTime);
  useEffect(() => {
    const id = setInterval(() => setTime(fmtTime()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontSize: 11, fontFamily: "var(--font-body-mono)" }}>{time}</span>
  );
}

function StripeSVG() {
  return (
    <svg width="132" height="13" viewBox="0 0 132 13" fill="none" preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", display: "block" }}>
      <rect width="130.517" height="13" fill="#DDDDDD" />
      <rect width="1" height="13" fill="#EEEEEE" />
      <rect x="130" width="1" height="13" fill="#C5C5C5" />
      {([1, 3, 5, 7, 9, 11] as number[]).map(y => (
        <rect key={y} y={y} width="131.268" height="1" fill="#999999" />
      ))}
    </svg>
  );
}

// Mac OS 9–style title bar: close box on left, title in center, collapse+zoom on right.
// Handles drag using the same algorithm as the library: offset from mouse→window edge at
// mousedown, then position = (clientX - parentRect.left - offsetX) on each mousemove.
function MacTitleBar({
  title,
  onPositionChange,
  onClose,
  onCollapse,
  onZoom,
}: {
  title: string;
  onPositionChange: (p: { x: number; y: number }) => void;
  onClose?: () => void;
  onCollapse?: () => void;
  onZoom?: () => void;
}) {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const windowEl = (e.currentTarget as HTMLElement).parentElement;
    if (!windowEl) return;
    const parent = windowEl.offsetParent as HTMLElement | null;
    const pr = parent ? parent.getBoundingClientRect() : { left: 0, top: 0, width: 1 };
    // Scale factor: viewport px / local px, handles CSS transform on ancestor.
    const scale = parent ? pr.width / parent.offsetWidth : 1;
    // Grab offset in local (unscaled) coordinate space.
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

  const btnStyle: React.CSSProperties = {
    width: 12, height: 12, padding: 0, margin: 0,
    background: "transparent",
    border: "1px solid #1a1a1a",
    cursor: "pointer",
    position: "relative",
    zIndex: 2,
    boxSizing: "border-box",
    flexShrink: 0,
    boxShadow: "inset -1px -1px 0 rgba(255,255,255,0.7), inset 1px 1px 0 rgba(0,0,0,0.25)",
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        display: "flex", alignItems: "center",
        background: "#CBCBCB",
        borderBottom: "1px solid black",
        minHeight: 22,
        padding: "0 8px",
        cursor: "grab",
        boxSizing: "border-box",
        userSelect: "none",
        gap: 6,
        overflow: "hidden",
      }}
    >
      {/* Left: close box */}
      {onClose && (
        <button style={btnStyle} onClick={onClose} aria-label="Close" title="Close" />
      )}

      {/* Center: stripe + title + stripe */}
      <div style={{ flex: 1, display: "grid", alignItems: "center", gridTemplateColumns: "1fr max-content 1fr", minWidth: 0 }}>
        <StripeSVG />
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.75rem", fontWeight: 700,
          whiteSpace: "nowrap", padding: "0 6px", color: "var(--color-text)",
        }}>
          {title}
        </div>
        <StripeSVG />
      </div>

      {/* Right: collapse + zoom */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {onCollapse && (
          <button style={btnStyle} onClick={onCollapse} aria-label="Collapse" title="Collapse">
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 6, height: 1, background: "#1a1a1a",
            }} />
          </button>
        )}
        {onZoom && (
          <button style={btnStyle} onClick={onZoom} aria-label="Zoom" title="Zoom">
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 4, height: 4, border: "1px solid #1a1a1a",
              boxSizing: "border-box",
            }} />
          </button>
        )}
      </div>
    </div>
  );
}


function FolderIcon({ selected }: { selected?: boolean }) {
  return (
    <img
      src="/folder.png"
      width={40}
      height={40}
      alt="Folder"
      style={{ opacity: selected ? 0.6 : 1 }}
      draggable={false}
    />
  );
}

function VideoIcon({ selected }: { selected?: boolean }) {
  return (
    <div style={{
      width: 40, height: 34,
      border: "1px solid #777",
      borderRadius: 2,
      background: selected ? "#000080" : "#1a1a1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: selected ? 0.75 : 1,
    }}>
      <span style={{ color: "#fff", fontSize: 15, lineHeight: 1 }}>▶</span>
    </div>
  );
}

// Self-contained YouTube QuickTime-style player. Manages its own player ref and state.
function VideoPlayer({ videoId, maximized, onToggleMaximize }: {
  videoId: string;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const playerRef = useRef<YTPlayer | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef = useRef(false);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, []);

  // Create YT player when user first presses play
  useEffect(() => {
    if (!started) return;
    const tryCreate = () => {
      if (playerRef.current || !divRef.current) return;
      const w = window as YTWindow;
      if (!w.YT?.Player) return;
      playerRef.current = new w.YT.Player(divRef.current, {
        width: "100%", height: "100%",
        videoId,
        playerVars: { controls: 0, autoplay: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onStateChange: ({ data }: { data: number }) => {
            if (data === 1) {
              setPlaying(true);
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                const p = playerRef.current;
                if (!p?.getCurrentTime) return;
                const cur: number = p.getCurrentTime();
                const dur: number = p.getDuration();
                if (dur > 0) setProgress(cur / dur);
              }, 300);
            } else if (data === 2 || data === 0 || data === -1) {
              setPlaying(false);
              if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            }
          },
        },
      });
    };
    const w = window as YTWindow;
    if (w.YT?.Player) tryCreate();
    else { const prev = w.onYouTubeIframeAPIReady; w.onYouTubeIframeAPIReady = () => { prev?.(); tryCreate(); }; }
  }, [started, videoId]);

  // Global mouse events for seek drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !seekBarRef.current || !playerRef.current) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur: number = playerRef.current.getDuration?.() ?? 0;
      if (dur > 0) { playerRef.current.seekTo(f * dur, true); setProgress(f); }
    };
    const onUp = () => { isDraggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handlePlayPause = () => {
    if (!started) { setStarted(true); return; }
    if (playing) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  };

  const handleSeekDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!started || !playerRef.current) return;
    e.preventDefault();
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur: number = playerRef.current.getDuration?.() ?? 0;
    if (dur > 0) { playerRef.current.seekTo(f * dur, true); setProgress(f); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, background: "#0d0d0d", position: "relative", minHeight: 0, overflow: "hidden" }}>
        {started && (
          <div className="yt-player-wrapper">
            <div ref={divRef} />
          </div>
        )}
        {started && <div style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "default" }} onClick={handlePlayPause} />}
        {!started && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px), #0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div onClick={handlePlayPause} style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #777", background: "radial-gradient(circle at 38% 32%, #5a5a5a, #1a1a1a)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ccc", fontSize: 20, paddingLeft: 4, boxShadow: "0 0 14px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12)" }}>▶</div>
            <span style={{ color: "#444", fontSize: 9, fontFamily: "var(--font-body-mono)", letterSpacing: "0.14em" }}>CLICK TO PLAY</span>
          </div>
        )}
      </div>
      <div style={{ background: "linear-gradient(180deg, #c8c8c8 0%, #a0a0a0 50%, #888 100%)", borderTop: "1px solid #555", padding: "4px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}>
        <button onClick={handlePlayPause} style={{ width: 22, height: 22, borderRadius: 3, border: "1px solid #555", background: "linear-gradient(180deg, #e0e0e0 0%, #b8b8b8 100%)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, color: "#222", flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 1px rgba(0,0,0,0.3)" }}>{playing ? "■" : "▶"}</button>
        <div ref={seekBarRef} onMouseDown={handleSeekDown} style={{ flex: 1, height: 10, position: "relative", background: "linear-gradient(180deg, #3a3a3a 0%, #555 100%)", borderRadius: 4, border: "1px solid #2a2a2a", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)", cursor: started ? "pointer" : "default", userSelect: "none", overflow: "visible" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, background: "linear-gradient(90deg, #6aaee0, #4888c8)", borderRadius: 4, overflow: "visible" }}>
            {started && <div style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(180deg, #f0f0f0 0%, #c0c0c0 100%)", border: "1px solid #444", boxShadow: "0 1px 3px rgba(0,0,0,0.5)", pointerEvents: "none" }} />}
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: "bold", fontFamily: "var(--font-body-mono)", color: "#444", letterSpacing: "0.04em", flexShrink: 0 }}>QT</span>
        <button onClick={onToggleMaximize} title={maximized ? "Restore" : "Maximize"} style={{ width: 22, height: 22, borderRadius: 3, border: "1px solid #555", background: "linear-gradient(180deg, #e0e0e0 0%, #b8b8b8 100%)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, color: "#222", flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 1px rgba(0,0,0,0.3)" }}>{maximized ? "⊟" : "⊞"}</button>
      </div>
    </div>
  );
}

function DesktopIcon({
  src,
  label,
  selected,
  onSelect,
  onOpen,
}: {
  src: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "default",
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen?.(); }}
    >
      <img
        src={src}
        width={40}
        height={40}
        alt={label}
        style={{ opacity: selected ? 0.6 : 1 }}
        draggable={false}
      />
      <span
        style={{
          color: "white",
          fontSize: 10,
          fontFamily: "var(--font-display)",
          padding: "1px 4px",
          background: selected ? "#000080" : "transparent",
          borderRadius: 2,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Readme card helper ───────────────────────────────────────────────────────

function ExpCard({ org, role, period, project, bullets }: {
  org: string; role: string; period: string; project?: string; bullets: string[];
}) {
  return (
    <div style={{
      border: "2px solid #111",
      borderRadius: 3,
      padding: "9px 12px 10px",
      background: "linear-gradient(150deg, #e8e8e8 0%, #d0d0d0 100%)",
      boxShadow: "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #888888",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontWeight: "bold", fontSize: 12, color: "#111" }}>{org}</span>
        <span style={{
          fontSize: 10,
          color: "#fff",
          background: "#555",
          border: "1px solid #222",
          boxShadow: "inset 1px 1px 0 #999, inset -1px -1px 0 #333",
          padding: "1px 6px",
          borderRadius: 2,
          fontFamily: "var(--font-body-mono)",
        }}>{period}</span>
      </div>
      <div style={{ fontSize: 11, color: "#333", fontStyle: "italic", marginBottom: project ? 2 : 5 }}>{role}</div>
      {project && (
        <div style={{
          fontSize: 10,
          color: "#1a3a6e",
          background: "linear-gradient(90deg, #b8c8e8 0%, #a8b8d8 100%)",
          border: "1px solid #4466aa",
          boxShadow: "inset 1px 1px 0 #d8e4f8, inset -1px -1px 0 #6688cc",
          padding: "1px 6px",
          borderRadius: 2,
          marginBottom: 5,
          fontFamily: "var(--font-body-mono)",
        }}>{project}</div>
      )}
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 11, lineHeight: 1.5, color: "#222", marginBottom: 2 }}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const MENUS = [
  {
    label: "File",
    items: (
      <>
        <MenuItem label="New Window" />
        <MenuItem label="Open" disabled separator />
        <MenuItem label="Close Window" />
      </>
    ),
  },
  {
    label: "Edit",
    items: (
      <>
        <MenuItem label="Undo" disabled separator />
        <MenuItem label="Cut" disabled />
        <MenuItem label="Copy" disabled />
        <MenuItem label="Paste" disabled />
      </>
    ),
  },
  {
    label: "View",
    items: (
      <>
        <MenuItem label="as Icons" />
        <MenuItem label="as List" />
      </>
    ),
  },
  {
    label: "Special",
    items: (
      <>
        <MenuItem label="Empty Trash…" separator />
        <MenuItem label="Restart" />
        <MenuItem label="Shut Down" />
      </>
    ),
  },
  {
    label: "Help",
    items: (
      <>
        <MenuItem label="About This Portfolio" />
      </>
    ),
  },
];

const PROJECT = {
  id: "my-project",
  title: "Creatures in TV",
  description:
    "A full-stack web application built with Next.js, TypeScript, and PostgreSQL. Features user authentication, real-time updates, and a responsive design.",
  tech: ["Next.js", "TypeScript", "PostgreSQL", "Tailwind CSS"],
  link: "https://github.com",
  year: "2024",
};

type SubWin = {
  id: string;
  projectName: string;
  kind: "about" | "video";
  pos: { x: number; y: number };
  size: { width: number; height: number };
  collapsed: boolean;
  maximized: boolean;
  restoreSize: { width: number; height: number };
  restorePos: { x: number; y: number };
};

export default function Home() {
  const [documentsOpen,        setDocumentsOpen]        = useState(false);
  const [documentsCollapsed,   setDocumentsCollapsed]   = useState(false);
  const [documentsMaximized,   setDocumentsMaximized]   = useState(false);
  const [documentsPos,         setDocumentsPos]         = useState({ x: 40, y: 18 });
  const [documentsRestoreSize, setDocumentsRestoreSize] = useState({ width: 400, height: 280 });
  const [documentsRestorePos,  setDocumentsRestorePos]  = useState({ x: 40, y: 18 });
  const [documentsSize,        setDocumentsSize]        = useState({ width: 400, height: 280 });
  const [subWins, setSubWins] = useState<SubWin[]>([]);
  // Which project is currently viewed inside the Projects window (null = root)
  const [documentsCurrentProject, setDocumentsCurrentProject] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [printerOpen,        setPrinterOpen]        = useState(false);
  const [printerCollapsed,   setPrinterCollapsed]   = useState(false);
  const [printerMaximized,   setPrinterMaximized]   = useState(false);
  const [printerPos,         setPrinterPos]         = useState({ x: 20, y: 15 });
  const [printerSize,        setPrinterSize]        = useState({ width: 520, height: 440 });
  const [printerRestoreSize, setPrinterRestoreSize] = useState({ width: 520, height: 440 });
  const [printerRestorePos,  setPrinterRestorePos]  = useState({ x: 20, y: 15 });
  const [readmeOpen,        setReadmeOpen]        = useState(false);
  const [readmeCollapsed,   setReadmeCollapsed]   = useState(false);
  const [readmeMaximized,   setReadmeMaximized]   = useState(false);
  const [readmeSize,        setReadmeSize]        = useState({ width: 480, height: 340 });
  const [readmePos,         setReadmePos]         = useState({ x: 118, y: 70 });
  const [readmeRestoreSize, setReadmeRestoreSize] = useState({ width: 480, height: 340 });
  const [readmeRestorePos,  setReadmeRestorePos]  = useState({ x: 118, y: 70 });
  const [skillsOpen,        setSkillsOpen]        = useState(false);
  const [skillsCollapsed,   setSkillsCollapsed]   = useState(false);
  const [skillsMaximized,   setSkillsMaximized]   = useState(false);
  const [skillsSize,        setSkillsSize]        = useState({ width: 460, height: 250 });
  const [skillsPos,         setSkillsPos]         = useState({ x: 125, y: 100 });
  const [skillsRestoreSize, setSkillsRestoreSize] = useState({ width: 460, height: 250 });
  const [skillsRestorePos,  setSkillsRestorePos]  = useState({ x: 125, y: 100 });
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const bootedRef  = useRef(false);
  const [booted,    setBooted]    = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [crtFlash,  setCrtFlash]  = useState(false);

  const triggerBoot = () => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const s = Math.min(
      (window.innerWidth  - 10) / SCR_W,
      (window.innerHeight - 10) / SCR_H,
    );
    setZoomScale(s);
    setBooted(true);
    setCrtFlash(true);
    setTimeout(() => setCrtFlash(false), 800);
  };

  // Auto-boot after 2 s; user can also click the power button to boot early.
  useEffect(() => {
    const t = setTimeout(triggerBoot, 2000);
    return () => clearTimeout(t);
  }, []);

  // Load YouTube IFrame API script once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as YTWindow).YT?.Player) return;
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  const clearSelection = () => setSelectedIcon(null);

  const openDocuments = () => {
    setDocumentsOpen(true);
    setActiveWindow("documents");
    setSelectedIcon(null);
  };

  // Navigate Projects window into a project folder (no new SubWin — in-place navigation)
  const openProject = (projectName: string) => {
    setDocumentsCurrentProject(projectName);
    setActiveWindow("documents");
  };

  // Open a file as its own independent window; focus if already open
  const openFileWindow = (projectName: string, kind: SubWin["kind"]) => {
    const existing = subWins.find(w => w.projectName === projectName && w.kind === kind);
    if (existing) { setActiveWindow(existing.id); return; }
    const id = `${projectName}-${kind}-${Date.now()}`;
    const isAbout = kind === "about";
    // about.txt: larger window, left-leaning; video: smaller, right-leaning
    const pos  = isAbout ? { x: 18, y: 12 }  : { x: 380, y: 38 };
    const size = isAbout ? { width: 560, height: 430 } : { width: 420, height: 320 };
    setSubWins(prev => [...prev, {
      id, projectName, kind,
      pos, size,
      collapsed: false, maximized: false,
      restoreSize: size, restorePos: pos,
    }]);
    setActiveWindow(id);
  };

  const closeSubWin = (id: string) => {
    setSubWins(prev => prev.filter(w => w.id !== id));
    setActiveWindow(null);
  };

  const updateSubWin = (id: string, update: Partial<SubWin>) => {
    setSubWins(prev => prev.map(w => w.id === id ? { ...w, ...update } : w));
  };

  const toggleSubWinMaximize = (win: SubWin) => {
    if (!win.maximized) {
      updateSubWin(win.id, {
        restoreSize: win.size, restorePos: win.pos,
        size: { width: MAX_W, height: MAX_H }, pos: { x: 5, y: 5 },
        maximized: true,
      });
    } else {
      updateSubWin(win.id, { size: win.restoreSize, pos: win.restorePos, maximized: false });
    }
  };

  const toggleMaximize = () => {
    if (!documentsMaximized) {
      setDocumentsRestoreSize(documentsSize);
      setDocumentsRestorePos(documentsPos);
      setDocumentsSize({ width: MAX_W, height: MAX_H });
      setDocumentsPos({ x: 5, y: 5 });
      setDocumentsMaximized(true);
    } else {
      setDocumentsSize(documentsRestoreSize);
      setDocumentsPos(documentsRestorePos);
      setDocumentsMaximized(false);
    }
  };

  const toggleReadmeMaximize = () => {
    if (!readmeMaximized) {
      setReadmeRestoreSize(readmeSize);
      setReadmeRestorePos(readmePos);
      setReadmeSize({ width: MAX_W, height: MAX_H });
      setReadmePos({ x: 5, y: 5 });
      setReadmeMaximized(true);
    } else {
      setReadmeSize(readmeRestoreSize);
      setReadmePos(readmeRestorePos);
      setReadmeMaximized(false);
    }
  };

  const toggleSkillsMaximize = () => {
    if (!skillsMaximized) {
      setSkillsRestoreSize(skillsSize);
      setSkillsRestorePos(skillsPos);
      setSkillsSize({ width: MAX_W, height: MAX_H });
      setSkillsPos({ x: 5, y: 5 });
      setSkillsMaximized(true);
    } else {
      setSkillsSize(skillsRestoreSize);
      setSkillsPos(skillsRestorePos);
      setSkillsMaximized(false);
    }
  };

  const togglePrinterMaximize = () => {
    if (!printerMaximized) {
      setPrinterRestoreSize(printerSize);
      setPrinterRestorePos(printerPos);
      setPrinterSize({ width: MAX_W, height: MAX_H });
      setPrinterPos({ x: 5, y: 5 });
      setPrinterMaximized(true);
    } else {
      setPrinterSize(printerRestoreSize);
      setPrinterPos(printerRestorePos);
      setPrinterMaximized(false);
    }
  };

  const openPrinter = () => {
    setPrinterOpen(true);
    setActiveWindow("printer");
    setSelectedIcon(null);
  };

  const openSkills = () => {
    setSkillsOpen(true);
    setActiveWindow("skills");
    setSelectedIcon(null);
  };

  const openReadme = () => {
    if (desktopRef.current) {
      // Use offsetWidth/Height (logical px, unaffected by the zoom transform)
      const w = desktopRef.current.offsetWidth;
      const h = desktopRef.current.offsetHeight;
      setReadmePos({
        x: Math.max(10, (w - readmeSize.width) / 2),
        y: Math.max(10, (h - readmeSize.height) / 2),
      });
    }
    setReadmeOpen(true);
    setActiveWindow("readme");
    setSelectedIcon(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#111",
        overflow: "hidden",
      }}
    >
      {/* Monitor frame — anchored so the screen hole center sits at 50 / 50 vw/vh.
          On boot, scale() from that same origin zooms straight into the screen. */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% - ${SCR_CX}px)`,
          top:  `calc(50% - ${SCR_CY}px)`,
          width:  `${MONITOR_W}px`,
          height: `${MONITOR_H}px`,
          transform: `scale(${zoomScale})`,
          transformOrigin: `${SCR_CX}px ${SCR_CY}px`,
          transition: booted ? "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      >
        {/* ── Boot overlays ────────────────────────────────────────────────── */}

        {/* Black screen — covers screen hole while off, fades on boot */}
        <div style={{
          position: "absolute",
          left: SCREEN.left, top: SCREEN.top,
          width: SCREEN.width, height: SCREEN.height,
          background: "#000",
          opacity: booted ? 0 : 1,
          transition: "opacity 0.45s ease",
          pointerEvents: booted ? "none" : "all",
          zIndex: 50,
        }} />

        {/* Glowing power button (iMac G3 lower-right bezel) */}
        {!booted && (
          <div
            onClick={triggerBoot}
            title="Power on"
            style={{
              position: "absolute",
              left: `${Math.round(0.835 * MONITOR_W)}px`,
              top:  `${Math.round(0.785 * MONITOR_H)}px`,
              transform: "translate(-50%, -50%)",
              width: 13, height: 13,
              borderRadius: "50%",
              background: "#1aff88",
              boxShadow: "0 0 8px 4px rgba(26,255,136,0.55), 0 0 22px 8px rgba(26,255,136,0.28)",
              cursor: "pointer",
              zIndex: 51,
              animation: "powerPulse 2s ease-in-out infinite",
            }}
          />
        )}

        {/* CRT white flash on power-on */}
        {crtFlash && (
          <div style={{
            position: "absolute",
            left: SCREEN.left, top: SCREEN.top,
            width: SCREEN.width, height: SCREEN.height,
            background: "white",
            animation: "crtFlash 0.8s ease-out forwards",
            pointerEvents: "none",
            zIndex: 52,
          }} />
        )}

        {/* ── OS 9 desktop — positioned to sit exactly in the screen hole ── */}
        <div
          ref={desktopRef}
          onClick={clearSelection}
          style={{
            position: "absolute",
            left: SCREEN.left,
            top: SCREEN.top,
            width: SCREEN.width,
            height: SCREEN.height,
            backgroundImage: "url('/background.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {/* Menu bar */}
          <MenuBar
            menus={MENUS}
            rightContent={<Clock />}
          />

          {/* Desktop area */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Right-side desktop icons (Mac OS 9 style) */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <DesktopIcon
                src="/readme-icon.png"
                label="readme"
                selected={selectedIcon === "readme"}
                onSelect={() => setSelectedIcon("readme")}
                onOpen={openReadme}
              />
              <DesktopIcon
                src="/folder.png"
                label="Projects"
                selected={selectedIcon === "documents"}
                onSelect={() => setSelectedIcon("documents")}
                onOpen={openDocuments}
              />
              <DesktopIcon
                src="/resume-icon.png"
                label="resume.pdf"
                selected={selectedIcon === "printer"}
                onSelect={() => setSelectedIcon("printer")}
                onOpen={openPrinter}
              />
              <DesktopIcon
                src="/trash.png"
                label="Trash"
                selected={selectedIcon === "trash"}
                onSelect={() => setSelectedIcon("trash")}
              />
              <DesktopIcon
                src="/internet-location.png"
                label="skills.txt"
                selected={selectedIcon === "skills"}
                onSelect={() => setSelectedIcon("skills")}
                onOpen={openSkills}
              />
            </div>

            {/* Readme / About window */}
            {readmeOpen && (
              <div onMouseDown={() => setActiveWindow("readme")} style={{ display: "contents" }}>
                <Window
                  title="readme — Erica (Kela) Liu"
                  active={activeWindow === "readme"}
                  draggable
                  resizable={!readmeCollapsed}
                  position={readmePos}
                  onPositionChange={setReadmePos}
                  width={readmeSize.width}
                  height={readmeCollapsed ? TITLEBAR_H : readmeSize.height}
                  onResize={(size) => setReadmeSize(size)}
                  titleBar={
                    <MacTitleBar
                      title="readme — Erica (Kela) Liu"
                      onPositionChange={setReadmePos}
                      onClose={() => { setReadmeOpen(false); setActiveWindow(null); setReadmeCollapsed(false); setReadmeMaximized(false); }}
                      onCollapse={() => setReadmeCollapsed(c => !c)}
                      onZoom={toggleReadmeMaximize}
                    />
                  }
                >
                  <div style={{
                    background: "#fff",
                    height: "100%",
                    overflowY: "auto",
                    fontFamily: "var(--font-body-mono)",
                    fontSize: 12,
                    color: "#111",
                    letterSpacing: "-0.03em",
                  }}>
                    <div style={{ padding: "20px 24px" }}>

                      {/* Name + links */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 19, fontWeight: "bold", marginBottom: 4 }}>Erica (Kela) Liu</div>
                        <div style={{ fontSize: 11, color: "#555", marginBottom: 7 }}>
                          Graduate Researcher &amp; AI/ML Engineer
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 11, flexWrap: "wrap" }}>
                          <a href="mailto:kl3734@columbia.edu" style={{ color: "#00c" }}>Email</a>
                          <span style={{ color: "#aaa" }}>·</span>
                          <a href="https://linkedin.com/in/erica-liu684" target="_blank" rel="noopener noreferrer" style={{ color: "#00c" }}>LinkedIn</a>
                          <span style={{ color: "#aaa" }}>·</span>
                          <a href="https://github.com/erica-ll" target="_blank" rel="noopener noreferrer" style={{ color: "#00c" }}>GitHub</a>
                        </div>
                      </div>

                      {/* Intro */}
                      <div style={{
                        fontSize: 11,
                        lineHeight: 1.7,
                        color: "#333",
                        marginBottom: 8,
                      }}>
                        I&apos;m a CS grad student at Columbia (MS, Dec 2026), coming from UCSB where I studied
                        Computer Science and Philosophy — a combination that still shapes how I think about systems
                        and the people who use them. My work lives at the intersection of computer vision and
                        generative AI: right now I&apos;m building a pipeline that animates static images into 2.5D
                        character motion using depth maps, segmentation, and diffusion models. I&apos;ve also done
                        research in biomedical image segmentation and spent a summer at a robotics startup pushing
                        stereo synthesis under tight compute constraints. I&apos;m drawn to problems where perception
                        and generation meet the real world — and I&apos;m always looking for the next hard thing to
                        build.
                      </div>

                    </div>
                  </div>
                </Window>
              </div>
            )}

            {/* Projects — single-pane file browser */}
            {documentsOpen && (
              <div onMouseDown={() => setActiveWindow("documents")} style={{ display: "contents" }}>
                <Window
                  title={documentsCurrentProject ?? "Projects"}
                  active={activeWindow === "documents"}
                  draggable
                  resizable={!documentsCollapsed}
                  position={documentsPos}
                  onPositionChange={setDocumentsPos}
                  width={documentsSize.width}
                  height={documentsCollapsed ? TITLEBAR_H : documentsSize.height}
                  onResize={(size) => setDocumentsSize(size)}
                  titleBar={
                    <MacTitleBar
                      title={documentsCurrentProject ?? "Projects"}
                      onPositionChange={setDocumentsPos}
                      onClose={() => { setDocumentsOpen(false); setDocumentsCurrentProject(null); setActiveWindow(null); setDocumentsCollapsed(false); setDocumentsMaximized(false); }}
                      onCollapse={() => setDocumentsCollapsed(c => !c)}
                      onZoom={toggleMaximize}
                    />
                  }
                >
                  {documentsCurrentProject === null ? (
                    /* Root: all project folders */
                    <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, 80px)", gap: "16px 12px", alignItems: "start", justifyContent: "start" }}>
                      <IconButton icon={<FolderIcon />} label={PROJECT.title} labelPosition="bottom" size="lg"
                        style={{ background: "transparent", border: "none", boxShadow: "none" }}
                        onDoubleClick={(e) => { e.stopPropagation(); openProject("Creatures in TV"); }} />
                      <IconButton icon={<FolderIcon />} label="VR Escape Room" labelPosition="bottom" size="lg"
                        style={{ background: "transparent", border: "none", boxShadow: "none" }}
                        onDoubleClick={(e) => { e.stopPropagation(); openProject("VR Escape Room"); }} />
                      <IconButton icon={<FolderIcon />} label="Zoo XR" labelPosition="bottom" size="lg"
                        style={{ background: "transparent", border: "none", boxShadow: "none" }}
                        onDoubleClick={(e) => { e.stopPropagation(); openProject("Zoo XR"); }} />
                    </div>
                  ) : (
                    /* Project view: back button + file icons */
                    <div style={{ position: "relative", height: "100%" }}>
                      <button
                        onClick={() => setDocumentsCurrentProject(null)}
                        style={{ position: "absolute", top: 10, left: 10, zIndex: 2, background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                      >
                        <img
                          src="/back-btn.png"
                          alt="← Projects"
                          draggable={false}
                          style={{ height: 22, width: "auto", imageRendering: "pixelated", display: "block", filter: "drop-shadow(1px 2px 0px rgba(0,0,0,0.5))" }}
                        />
                      </button>
                      <div style={{ height: "100%", overflowY: "auto", padding: "40px 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, 80px)", gap: "16px 12px", alignItems: "start", justifyContent: "start" }}>
                        <IconButton
                          icon={<img src="/readme-icon.png" width={40} height={40} alt="" draggable={false} />}
                          label="about.txt" labelPosition="bottom" size="lg"
                          style={{ background: "transparent", border: "none", boxShadow: "none" }}
                          onDoubleClick={(e) => { e.stopPropagation(); openFileWindow(documentsCurrentProject, "about"); }}
                        />
                        {(documentsCurrentProject === "VR Escape Room" || documentsCurrentProject === "Zoo XR") && (
                          <IconButton
                            icon={<VideoIcon />}
                            label="demo.mp4" labelPosition="bottom" size="lg"
                            style={{ background: "transparent", border: "none", boxShadow: "none" }}
                            onDoubleClick={(e) => { e.stopPropagation(); openFileWindow(documentsCurrentProject, "video"); }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </Window>
              </div>
            )}

            {/* File windows — each opened file is its own independent window */}
            {subWins.map(win => (
              <div key={win.id} onMouseDown={() => setActiveWindow(win.id)} style={{ display: "contents" }}>
                <Window
                  title={win.kind === "about" ? "about.txt" : "demo.mp4"}
                  active={activeWindow === win.id}
                  draggable
                  resizable={!win.collapsed}
                  position={win.pos}
                  onPositionChange={(p) => updateSubWin(win.id, { pos: p })}
                  width={win.size.width}
                  height={win.collapsed ? TITLEBAR_H : win.size.height}
                  onResize={(size) => updateSubWin(win.id, { size })}
                  titleBar={
                    <MacTitleBar
                      title={win.kind === "about" ? `about.txt — ${win.projectName}` : `demo.mp4 — ${win.projectName}`}
                      onPositionChange={(p) => updateSubWin(win.id, { pos: p })}
                      onClose={() => closeSubWin(win.id)}
                      onCollapse={() => updateSubWin(win.id, { collapsed: !win.collapsed })}
                      onZoom={() => toggleSubWinMaximize(win)}
                    />
                  }
                >
                  {/* VR Escape Room — about.txt */}
                  {win.kind === "about" && win.projectName === "VR Escape Room" && (
                    <div style={{ height: "100%", overflowY: "auto", padding: "14px 18px", fontFamily: "var(--font-body-mono)", fontSize: 10, letterSpacing: "-0.03em", color: "#222" }}>
                      <h2 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>VR Escape Room: Chrono Paradox</h2>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 10, fontStyle: "italic" }}>Meta Quest · Unity · Multi-Stage Puzzle VR</div>
                      <p style={{ lineHeight: 1.7, marginBottom: 14, color: "#333" }}>
                        A thematic VR escape room developed for the Meta Quest, utilizing Unity and the Meta XR SDK.
                        The experience integrates continuous locomotion, precise object manipulation, and spatial UI to guide
                        players through a multi-stage puzzle sequence across two rooms representing the past and the future.
                      </p>
                      <div style={{ fontSize: 9, fontWeight: "bold", letterSpacing: "0.08em", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Core Systems</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Dynamic Asset Swapping (Time Barrier)</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Engineered a spatial trigger system that updates 3D meshes and materials in real-time. When grabbed objects cross a localized &ldquo;time barrier,&rdquo; their visual states transition between future and retro aesthetics without interrupting the XR grab interaction.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Real-Time Spatial Minimap</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Architected a dynamic wayfinding system that continuously tracks the player&apos;s spatial transform data and mathematically maps it to a responsive 2D UI interface.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>State-Driven UI Markers</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Implemented an event-driven logic system for map markers. Exploration flags automatically update their visual states (from unexplored to completed) by listening to specific puzzle triggers and player location data.</p>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Collaborative Systems Design</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Co-designed the core logic and puzzles with teammates, linking exploratory tasks (e.g., the bookshelf passcode search) with mechanical obstacles (e.g., the buzz-wire challenge) to construct a complete escape sequence.</p>
                      </div>
                      <div style={{ borderTop: "1px solid #ddd", paddingTop: 10, fontSize: 9, color: "#666", lineHeight: 1.8 }}>
                        <div><strong>Platform:</strong> Meta Quest</div>
                        <div><strong>Tech Stack:</strong> Unity 3D | C# | Meta XR SDK | XR Interaction Toolkit (XRI) | Spatial UI</div>
                      </div>
                    </div>
                  )}

                  {/* Video player — shared component, picks videoId by project */}
                  {win.kind === "video" && (
                    <VideoPlayer
                      videoId={win.projectName === "VR Escape Room" ? "tJwE_XEiMno" : "YYU9Jj6YMrg"}
                      maximized={win.maximized}
                      onToggleMaximize={() => toggleSubWinMaximize(win)}
                    />
                  )}

                  {/* Zoo XR — about.txt */}
                  {win.kind === "about" && win.projectName === "Zoo XR" && (
                    <div style={{ height: "100%", overflowY: "auto", padding: "14px 18px", fontFamily: "var(--font-body-mono)", fontSize: 10, letterSpacing: "-0.03em", color: "#222" }}>
                      <h2 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>Zoo XR</h2>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 10, fontStyle: "italic" }}>Cross-Platform AR Builder to VR Experience</div>
                      <p style={{ lineHeight: 1.7, marginBottom: 14, color: "#333" }}>
                        An end-to-end XR application featuring an augmented reality mobile builder interface for spatial design,
                        which seamlessly exports to a virtual reality exploration environment for the Meta Quest.
                        The project focuses on cross-platform data serialization, spatial constraints validation, and interactive physics.
                      </p>
                      <div style={{ fontSize: 9, fontWeight: "bold", letterSpacing: "0.08em", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Core Systems</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Cross-Platform Serialization Pipeline</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Designed a data pipeline to export the entire AR scene layout — objects, transforms, and enclosure metadata — into a JSON format, enabling dynamic deserialization and full scene reconstruction in the VR environment.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Rule-Based Validation System (AR)</div>
                        <p style={{ lineHeight: 1.7, color: "#444", marginBottom: 8 }}>Constraint-checking architecture to validate scene logic before VR export:</p>
                        <ul style={{ margin: 0, paddingLeft: 16, color: "#444", lineHeight: 1.8 }}>
                          <li>Calculates spatial relationships to ensure all enclosures are fully fenced and contain animals</li>
                          <li>Validates pathfinding connectivity leading to each enclosure and correct placement of food bins</li>
                        </ul>
                        <div style={{ marginTop: 10, background: "#eee", border: "1px dashed #bbb", borderRadius: 3, padding: "18px 12px", textAlign: "center", color: "#999", fontSize: 9, letterSpacing: "0.06em" }}>[ CONSTRAINT VALIDATION SCREENSHOTS ]</div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Spatial Anchoring &amp; Scaling (AR)</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Implemented individual object manipulation (translate / rotate / scale) alongside a global scaling system with a 1-meter physical reference, ensuring accurate real-world size mapping when transitioning from mobile AR to the VR headset.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Behavioral State Machines (VR)</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Programmed Finite State Machines for animal AI. Animals dynamically transition between states — fleeing out of fear, eating, following the player — based on proximity and player interactions.</p>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Physics-Based Interactions (VR)</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Implemented hands-on VR mechanics including physics-driven enclosure doors and visual petting interactions that update animals&apos; internal emotional states.</p>
                      </div>
                      <div style={{ borderTop: "1px solid #ddd", paddingTop: 10, fontSize: 9, color: "#666", lineHeight: 1.8 }}>
                        <div><strong>Platform:</strong> iOS (AR) · Meta Quest 3 (VR)</div>
                        <div><strong>Tech Stack:</strong> Unity 3D | C# | AR Foundation | XR Interaction Toolkit (XRI) | Meta Quest SDK</div>
                      </div>
                    </div>
                  )}

                  {/* Creatures in TV — about.txt */}
                  {win.kind === "about" && win.projectName === "Creatures in TV" && (
                    <div style={{ height: "100%", overflowY: "auto", padding: "14px 18px", fontFamily: "var(--font-body-mono)", fontSize: 10, letterSpacing: "-0.03em", color: "#222" }}>
                      <h2 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>Creatures in TV</h2>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 10, fontStyle: "italic" }}>Multimodal Text-to-Animation Pipeline</div>
                      <p style={{ lineHeight: 1.7, marginBottom: 14, color: "#333" }}>
                        A full-stack, cloud-deployed AI application that transforms static 2D photos into dynamic animated scenes
                        by bringing imaginative creatures into personal photos. By orchestrating generative AI models with advanced
                        computer vision segmentation, the pipeline allows users to hatch custom creatures and direct their
                        interactions within a spatially-aware environment of their choice.
                      </p>
                      <div style={{ fontSize: 9, fontWeight: "bold", letterSpacing: "0.08em", color: "#888", marginBottom: 6, textTransform: "uppercase" }}>Core Systems</div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Generative Asset Pipeline</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Integrated the Gemini API to dynamically generate creature concepts and corresponding multi-action sprite sheets from user text prompts.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Computer Vision &amp; Scene Processing</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Engineered a backend Python pipeline utilizing SAM2 (Segment Anything Model 2) to process user-uploaded photos, automatically generating segmented masks and depth maps for spatial awareness.</p>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Algorithmic Trajectory &amp; Depth Logic</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Developed an auto-pathing recommendation algorithm that analyzes scene masks to suggest realistic traversal routes. Implemented depth-sorting logic to ensure creatures seamlessly occlude or hide behind real-world objects in the photo.</p>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontWeight: "bold", fontSize: 10, marginBottom: 4, color: "#111" }}>Cloud Infrastructure &amp; Deployment</div>
                        <p style={{ lineHeight: 1.7, color: "#444", margin: 0 }}>Containerized the heavy machine-learning backend and web frontend, successfully deploying the end-to-end application on AWS ECS (Elastic Container Service) for public web access.</p>
                      </div>

                      {/* Future Research — Mac OS "Note" box style */}
                      <div style={{
                        margin: "0 0 14px 0",
                        background: "#fffbec",
                        border: "1px solid #d4a820",
                        borderLeft: "3px solid #d4a820",
                        borderRadius: 2,
                        padding: "9px 12px",
                      }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", fontWeight: 700, color: "#a07800", marginBottom: 5, letterSpacing: "0.04em" }}>
                          ✦ FUTURE RESEARCH
                        </div>
                        <p style={{ lineHeight: 1.7, color: "#6b5200", margin: 0, fontStyle: "italic" }}>
                          While current iterations rely on GenAI for sprite rendering, ongoing research aims to decouple animation
                          from pure image generation. The next phase will explore overlaying programmatic procedural animations
                          and emotion-driven state machines onto simplified base meshes, prioritizing expressive, fine-grained
                          control over computational brute force.
                        </p>
                      </div>

                      <div style={{ borderTop: "1px solid #ddd", paddingTop: 10, fontSize: 9, color: "#666", lineHeight: 1.8 }}>
                        <div><strong>Tech Stack:</strong> Python | Gemini API | SAM2 (Computer Vision) | AWS ECS | Web Frontend (JS/HTML) | Generative AI</div>
                      </div>
                    </div>
                  )}
                </Window>
              </div>
            ))}

            {/* Print preview window */}
            {printerOpen && (
              <div onMouseDown={() => setActiveWindow("printer")} style={{ display: "contents" }}>
                <Window
                  title="resume.pdf"
                  active={activeWindow === "printer"}
                  draggable
                  resizable={!printerCollapsed}
                  position={printerPos}
                  onPositionChange={setPrinterPos}
                  width={printerSize.width}
                  height={printerCollapsed ? TITLEBAR_H : printerSize.height}
                  onResize={(size) => setPrinterSize(size)}
                  titleBar={
                    <MacTitleBar
                      title="resume.pdf"
                      onPositionChange={setPrinterPos}
                      onClose={() => { setPrinterOpen(false); setActiveWindow(null); setPrinterCollapsed(false); setPrinterMaximized(false); }}
                      onCollapse={() => setPrinterCollapsed(c => !c)}
                      onZoom={togglePrinterMaximize}
                    />
                  }
                >
                  <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px", fontFamily: "var(--font-body-mono)", fontSize: 12, color: "#111", letterSpacing: "-0.03em", background: "linear-gradient(180deg, #d4d4d4 0%, #c8c8c8 100%)" }}>
                    <div style={{ fontSize: 9, fontWeight: "bold", letterSpacing: "0.1em", color: "#fff", background: "#444", border: "2px solid #111", boxShadow: "inset 1px 1px 0 #888, inset -1px -1px 0 #222", padding: "2px 8px", marginBottom: 10, display: "inline-block" }}>EXPERIENCE</div>
                    <ExpCard
                      org="Columbia University"
                      role="Research Assistant"
                      period="Jan 2026 – Present"
                      project="Multimodal Text-to-Animation Pipeline"
                      bullets={[
                        "Animating static images into 2.5D character motion via depth maps, segmentation labels, and natural language prompts",
                        "Using image-to-video diffusion models for motion priors + skeletal rig extraction to isolate movement",
                        "Reintegrating rigs back to the source image to preserve background and character fidelity",
                      ]}
                    />
                    <ExpCard
                      org="Linx Robot"
                      role="AI/ML Intern"
                      period="Jun – Aug 2025"
                      project="Generative AI Stereo Synthesis Pipeline"
                      bullets={[
                        "End-to-end data generation pipeline using DDPMs to accelerate stereo camera R&D",
                        "Strict conditioning controls → geometry- and pixel-accurate right-eye generation with minimal hallucinations",
                        "Optimized 2K stereo synthesis under compute constraints; presented trade-off analyses cross-functionally",
                      ]}
                    />
                    <ExpCard
                      org="UC Irvine"
                      role="Research Assistant"
                      period="Jul 2024 – Aug 2025"
                      project="Biomedical Image Segmentation"
                      bullets={[
                        "Cascaded 3D U-Net in PyTorch: sequential liver → tumor → resection prediction stages",
                        "Co-authored accepted paper at IEEE ISBI 2026 on automated 3D segmentation for liver surgical planning",
                      ]}
                    />
                    <ExpCard
                      org="UC Santa Barbara × FOIA Friend"
                      role="Capstone Project"
                      period="Sep 2024 – Apr 2025"
                      project="LLM-Powered Document Evaluation (FARE)"
                      bullets={[
                        "AI text editor + rating system for FOIA requests using LLMs and Transformers — 82% rubric accuracy",
                        "Led model integration into web platform; 90%+ positive user feedback on accessibility and performance",
                      ]}
                    />
                    {/* Download button — at end of scrollable content */}
                    <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 8px" }}>
                      <a
                        href="/Erica (Kela) Liu Resume.pdf"
                        download="Erica (Kela) Liu Resume.pdf"
                        style={{ display: "block", cursor: "pointer" }}
                      >
                        <img
                          src="/download-btn.png"
                          alt="Download PDF"
                          draggable={false}
                          style={{ width: 130, height: "auto", imageRendering: "pixelated", display: "block", filter: "drop-shadow(2px 3px 0px rgba(0,0,0,0.55))" }}
                        />
                      </a>
                    </div>
                  </div>
                </Window>
              </div>
            )}

            {/* Skills window */}
            {skillsOpen && (
              <div onMouseDown={() => setActiveWindow("skills")} style={{ display: "contents" }}>
                <Window
                  title="skills.txt"
                  active={activeWindow === "skills"}
                  draggable
                  resizable={!skillsCollapsed}
                  position={skillsPos}
                  onPositionChange={setSkillsPos}
                  width={skillsSize.width}
                  height={skillsCollapsed ? TITLEBAR_H : skillsSize.height}
                  onResize={(size) => setSkillsSize(size)}
                  titleBar={
                    <MacTitleBar
                      title="skills.txt"
                      onPositionChange={setSkillsPos}
                      onClose={() => { setSkillsOpen(false); setActiveWindow(null); setSkillsCollapsed(false); setSkillsMaximized(false); }}
                      onCollapse={() => setSkillsCollapsed(c => !c)}
                      onZoom={toggleSkillsMaximize}
                    />
                  }
                >
                  <div style={{ height: "100%", overflowY: "auto", padding: "12px 14px", background: "linear-gradient(180deg, #d4d4d4 0%, #c8c8c8 100%)", display: "flex", gap: 12 }}>
                    {([
                      {
                        label: "ML / AI",
                        items: [
                          { name: "Python",      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" },
                          { name: "PyTorch",     icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg" },
                          { name: "OpenCV",      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opencv/opencv-original.svg" },
                          { name: "HuggingFace", icon: "/huggingface-icon.png" },
                        ],
                      },
                      {
                        label: "Game Dev / XR",
                        items: [
                          { name: "Unity",       icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/unity/unity-original.svg" },
                          { name: "C#",          icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg" },
                          { name: "Meta XR SDK", icon: null },
                        ],
                      },
                      {
                        label: "Software / Web",
                        items: [
                          { name: "React",      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" },
                          { name: "Next.js",    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg" },
                          { name: "TypeScript", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" },
                          { name: "AWS",        icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg" },
                          { name: "C++",        icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg" },
                          { name: "SQL",        icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg" },
                        ],
                      },
                    ] as { label: string; items: { name: string; icon: string | null }[] }[]).map(({ label, items }) => (
                      <div key={label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ fontSize: 7, fontWeight: "bold", letterSpacing: "0.1em", color: "#fff", background: "#444", border: "2px solid #111", boxShadow: "inset 1px 1px 0 #888, inset -1px -1px 0 #222", padding: "2px 6px", marginBottom: 3, display: "block", fontFamily: "var(--font-body-mono)", textAlign: "center" }}>{label}</div>
                        {items.map(({ name, icon }) => (
                          <div key={name} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            border: "1px solid #aaa", borderRadius: 3, padding: "4px 8px",
                            background: "linear-gradient(150deg, #e8e8e8 0%, #d8d8d8 100%)",
                            boxShadow: "inset 1px 1px 0 #fff, inset -1px -1px 0 #bbb",
                          }}>
                            <div style={{ width: 14, height: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {icon && <img src={icon} alt={name} style={{ width: 14, height: 14, objectFit: "contain", display: "block" }} />}
                            </div>
                            <span style={{ fontSize: 8, fontWeight: 600, fontFamily: "var(--font-body-mono)", color: "#111", whiteSpace: "nowrap" }}>{name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Window>
              </div>
            )}

          </div>
        </div>

        {/* ── Monitor frame overlay (sits on top, lets screen hole show through) ── */}
        <img
          src="/desk-full-clean.png"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 20,
            filter: "brightness(1.35) saturate(1.1)",
          }}
        />
      </div>
    </div>
  );
}
