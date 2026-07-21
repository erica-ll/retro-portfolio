"use client";

import { useState, useEffect, useRef } from "react";
import {
  MenuBar,
  MenuItem,
  Window,
  IconButton,
} from "@liiift-studio/mac-os9-ui";

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

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    };
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontSize: 12, fontFamily: "var(--font-system)" }}>{time}</span>
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

  const StripeSVG = () => (
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
          fontFamily: "var(--font-system)",
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
      border: "1px solid #bbb",
      borderRadius: 4,
      padding: "10px 12px",
      background: "#fafafa",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontWeight: "bold", fontSize: 13 }}>{org}</span>
        <span style={{ fontSize: 11, color: "#666" }}>{period}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: project ? 2 : 6 }}>{role}</div>
      {project && <div style={{ fontSize: 11, fontStyle: "italic", color: "#444", marginBottom: 5 }}>{project}</div>}
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "#222", marginBottom: 2 }}>{b}</li>
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
  title: "My Project",
  description:
    "A full-stack web application built with Next.js, TypeScript, and PostgreSQL. Features user authentication, real-time updates, and a responsive design.",
  tech: ["Next.js", "TypeScript", "PostgreSQL", "Tailwind CSS"],
  link: "https://github.com",
  year: "2024",
};

type SubWin = {
  id: string;
  projectName: string;
  file: string | null;
  selectedItem: string | null;
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
  const [documentsPos,         setDocumentsPos]         = useState({ x: 40, y: 30 });
  const [documentsRestoreSize, setDocumentsRestoreSize] = useState({ width: 400, height: 280 });
  const [documentsRestorePos,  setDocumentsRestorePos]  = useState({ x: 40, y: 30 });
  const [documentsSize,        setDocumentsSize]        = useState({ width: 400, height: 280 });
  // Per-project sub-windows (Mac OS 9 style: each project opens its own window)
  const [subWins, setSubWins] = useState<SubWin[]>([]);
  const [vrVideoPlaying,    setVrVideoPlaying]    = useState(false);
  const [vrStarted,         setVrStarted]         = useState(false);
  const [videoProgress,     setVideoProgress]     = useState(0);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [printerOpen,        setPrinterOpen]        = useState(false);
  const [printerCollapsed,   setPrinterCollapsed]   = useState(false);
  const [printerMaximized,   setPrinterMaximized]   = useState(false);
  const [printerPos,         setPrinterPos]         = useState({ x: 20, y: 20 });
  const [printerSize,        setPrinterSize]        = useState({ width: 460, height: 520 });
  const [printerRestoreSize, setPrinterRestoreSize] = useState({ width: 460, height: 520 });
  const [printerRestorePos,  setPrinterRestorePos]  = useState({ x: 20, y: 20 });
  const [readmeOpen,        setReadmeOpen]        = useState(false);
  const [readmeCollapsed,   setReadmeCollapsed]   = useState(false);
  const [readmeMaximized,   setReadmeMaximized]   = useState(false);
  const [readmeSize,        setReadmeSize]        = useState({ width: 640, height: 460 });
  const [readmePos,         setReadmePos]         = useState({ x: 30, y: 20 });
  const [readmeRestoreSize, setReadmeRestoreSize] = useState({ width: 640, height: 460 });
  const [readmeRestorePos,  setReadmeRestorePos]  = useState({ x: 30, y: 20 });
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const desktopRef         = useRef<HTMLDivElement>(null);
  const bootedRef          = useRef(false);
  const ytPlayerRef        = useRef<any>(null);
  const ytDivRef           = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef      = useRef(false);
  const seekBarRef         = useRef<HTMLDivElement>(null);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load YouTube IFrame API script once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).YT?.Player) return;
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  // Global mouse events for seek-bar drag (refs are always fresh — no stale closure)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !seekBarRef.current || !ytPlayerRef.current) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur: number = ytPlayerRef.current.getDuration?.() ?? 0;
      if (dur > 0) { ytPlayerRef.current.seekTo(f * dur, true); setVideoProgress(f); }
    };
    const onUp = () => { isDraggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const cleanupVideoPlayer = () => {
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    setVrVideoPlaying(false);
    setVrStarted(false);
    setVideoProgress(0);
  };

  const clearSelection = () => setSelectedIcon(null);

  const openDocuments = () => {
    setDocumentsOpen(true);
    setActiveWindow("documents");
    setSelectedIcon(null);
  };

  // Mac OS 9–style: each project folder opens its own window
  const openProject = (projectName: string) => {
    const existing = subWins.find(w => w.projectName === projectName);
    if (existing) { setActiveWindow(existing.id); return; }
    const id = `${projectName}-${Date.now()}`;
    const offset = subWins.length * 20;
    setSubWins(prev => [...prev, {
      id, projectName, file: null, selectedItem: null,
      pos: { x: 60 + offset, y: 50 + offset },
      size: { width: 420, height: 300 },
      collapsed: false, maximized: false,
      restoreSize: { width: 420, height: 300 },
      restorePos: { x: 60 + offset, y: 50 + offset },
    }]);
    setActiveWindow(id);
  };

  const closeSubWin = (id: string, projectName: string) => {
    if (projectName === "VR Escape Room") cleanupVideoPlayer();
    setSubWins(prev => prev.filter(w => w.id !== id));
    setActiveWindow(null);
  };

  const updateSubWin = (id: string, update: Partial<SubWin>) => {
    setSubWins(prev => prev.map(w => w.id === id ? { ...w, ...update } : w));
  };

  const openSubWinFile = (win: SubWin, filename: string) => {
    if (win.file === "demo.mp4" && filename !== "demo.mp4") cleanupVideoPlayer();
    updateSubWin(win.id, { file: filename, selectedItem: null });
  };

  const closeSubWinFile = (win: SubWin) => {
    if (win.file === "demo.mp4") cleanupVideoPlayer();
    updateSubWin(win.id, { file: null, selectedItem: null });
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

  // Create / destroy YouTube IFrame player when vrStarted toggles
  useEffect(() => {
    if (!vrStarted) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
        ytPlayerRef.current = null;
      }
      if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
      return;
    }
    const tryCreate = () => {
      if (ytPlayerRef.current || !ytDivRef.current) return;
      const w = window as any;
      if (!w.YT?.Player) return;
      ytPlayerRef.current = new w.YT.Player(ytDivRef.current, {
        width: "100%", height: "100%",
        videoId: "gVotu8LDLiQ",
        playerVars: { controls: 0, autoplay: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1 },
        events: {
          onStateChange: ({ data }: { data: number }) => {
            if (data === 1) { // playing
              setVrVideoPlaying(true);
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = setInterval(() => {
                const p = ytPlayerRef.current;
                if (!p?.getCurrentTime) return;
                const cur: number = p.getCurrentTime();
                const dur: number = p.getDuration();
                if (dur > 0) setVideoProgress(cur / dur);
              }, 300);
            } else if (data === 2 || data === 0 || data === -1) { // paused, ended, unstarted
              setVrVideoPlaying(false);
              if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
            }
          },
        },
      });
    };
    const w = window as any;
    if (w.YT?.Player) {
      tryCreate();
    } else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { prev?.(); tryCreate(); };
    }
  }, [vrStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstPlay = () => setVrStarted(true);

  const handlePlayPause = () => {
    if (!vrStarted) { handleFirstPlay(); return; }
    if (vrVideoPlaying) {
      ytPlayerRef.current?.pauseVideo();
    } else {
      ytPlayerRef.current?.playVideo();
    }
  };

  const handleSeekBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!vrStarted || !ytPlayerRef.current) return;
    e.preventDefault();
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur: number = ytPlayerRef.current.getDuration?.() ?? 0;
    if (dur > 0) { ytPlayerRef.current.seekTo(f * dur, true); setVideoProgress(f); }
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
                src="/printer.png"
                label="Printer"
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
                    fontFamily: "var(--font-system)",
                    fontSize: 13,
                    color: "#111",
                  }}>
                    <div style={{ padding: "20px 24px" }}>

                      {/* Name + links */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 4 }}>Erica (Kela) Liu</div>
                        <div style={{ fontSize: 12, color: "#555", marginBottom: 7 }}>
                          Graduate Researcher &amp; AI/ML Engineer
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 12, flexWrap: "wrap" }}>
                          <a href="mailto:kl3734@columbia.edu" style={{ color: "#00c" }}>Email</a>
                          <span style={{ color: "#aaa" }}>·</span>
                          <a href="https://linkedin.com/in/erica-liu684" target="_blank" rel="noopener noreferrer" style={{ color: "#00c" }}>LinkedIn</a>
                          <span style={{ color: "#aaa" }}>·</span>
                          <a href="https://github.com/erica-ll" target="_blank" rel="noopener noreferrer" style={{ color: "#00c" }}>GitHub</a>
                        </div>
                      </div>

                      {/* Intro */}
                      <div style={{
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: "#333",
                        marginBottom: 16,
                        paddingBottom: 14,
                        borderBottom: "1px solid #ddd",
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

                      {/* Experience */}
                      <div style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "0.06em", color: "#888", marginBottom: 10 }}>
                        EXPERIENCE
                      </div>

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

                    </div>
                  </div>
                </Window>
              </div>
            )}

            {/* Projects — single-pane file browser */}
            {documentsOpen && (
              <div onMouseDown={() => setActiveWindow("documents")} style={{ display: "contents" }}>
                <Window
                  title="Projects"
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
                      title="Projects"
                      onPositionChange={setDocumentsPos}
                      onClose={() => { setDocumentsOpen(false); setActiveWindow(null); setDocumentsCollapsed(false); setDocumentsMaximized(false); }}
                      onCollapse={() => setDocumentsCollapsed(c => !c)}
                      onZoom={toggleMaximize}
                    />
                  }
                >
                  {/* Projects window always shows the root folder list */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                    <IconButton
                      icon={<FolderIcon />}
                      label={PROJECT.title} labelPosition="bottom" size="lg"
                      style={{ background: "transparent", border: "none", boxShadow: "none" }}
                      onDoubleClick={(e) => { e.stopPropagation(); openProject("My Project"); }}
                    />
                    <IconButton
                      icon={<FolderIcon />}
                      label="VR Escape Room" labelPosition="bottom" size="lg"
                      style={{ background: "transparent", border: "none", boxShadow: "none" }}
                      onDoubleClick={(e) => { e.stopPropagation(); openProject("VR Escape Room"); }}
                    />
                  </div>
                </Window>
              </div>
            )}

            {/* Project sub-windows — Mac OS 9 style: each project opens its own window */}
            {subWins.map(win => (
              <div key={win.id} onMouseDown={() => setActiveWindow(win.id)} style={{ display: "contents" }}>
                <Window
                  title={win.file ?? win.projectName}
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
                      title={win.file ?? win.projectName}
                      onPositionChange={(p) => updateSubWin(win.id, { pos: p })}
                      onClose={() => closeSubWin(win.id, win.projectName)}
                      onCollapse={() => updateSubWin(win.id, { collapsed: !win.collapsed })}
                      onZoom={() => toggleSubWinMaximize(win)}
                    />
                  }
                >
                  {/* VR Escape Room — folder view */}
                  {win.projectName === "VR Escape Room" && win.file === null && (
                    <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                      <IconButton
                        icon={<img src="/readme-icon.png" width={40} height={40} alt="" draggable={false} style={{ opacity: win.selectedItem === "vr-about" ? 0.6 : 1 }} />}
                        label="about.txt" labelPosition="bottom" size="lg"
                        style={{ background: "transparent", border: "none", boxShadow: "none" }}
                        onClick={(e) => { e.stopPropagation(); updateSubWin(win.id, { selectedItem: "vr-about" }); }}
                        onDoubleClick={(e) => { e.stopPropagation(); openSubWinFile(win, "about.txt"); }}
                      />
                      <IconButton
                        icon={<VideoIcon selected={win.selectedItem === "vr-video"} />}
                        label="demo.mp4" labelPosition="bottom" size="lg"
                        style={{ background: "transparent", border: "none", boxShadow: "none" }}
                        onClick={(e) => { e.stopPropagation(); updateSubWin(win.id, { selectedItem: "vr-video" }); }}
                        onDoubleClick={(e) => { e.stopPropagation(); openSubWinFile(win, "demo.mp4"); }}
                      />
                    </div>
                  )}

                  {/* VR Escape Room — about.txt */}
                  {win.projectName === "VR Escape Room" && win.file === "about.txt" && (
                    <div style={{ height: "100%", overflowY: "auto" }}>
                      <div style={{ padding: "4px 8px", borderBottom: "1px solid #ccc", background: "#f0f0f0", flexShrink: 0 }}>
                        <button onClick={() => closeSubWinFile(win)} style={{ border: "1px solid #aaa", borderRadius: 2, background: "#e0e0e0", padding: "1px 8px", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-system)" }}>← Back</button>
                      </div>
                      <div style={{ padding: "12px 16px", fontFamily: "var(--font-system)", fontSize: 11 }}>
                        <h2 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>VR Escape Room</h2>
                        <p style={{ lineHeight: 1.6, marginBottom: 10, color: "#333" }}>A virtual reality escape room experience built with [technology stack]. Players solve puzzles and navigate immersive environments.</p>
                        <div style={{ background: "#eee", border: "1px dashed #aaa", borderRadius: 3, padding: "20px", textAlign: "center", color: "#888", fontSize: 10, marginBottom: 10 }}>[ images go here ]</div>
                        <div style={{ fontSize: 10, color: "#666", lineHeight: 1.8 }}>
                          <strong>Tech:</strong> [engine / frameworks]<br />
                          <strong>Role:</strong> [your role]<br />
                          <strong>Year:</strong> [year]
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VR Escape Room — demo.mp4 QuickTime player */}
                  {win.projectName === "VR Escape Room" && win.file === "demo.mp4" && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <div style={{ padding: "4px 8px", borderBottom: "1px solid #ccc", background: "#f0f0f0", flexShrink: 0 }}>
                        <button onClick={() => closeSubWinFile(win)} style={{ border: "1px solid #aaa", borderRadius: 2, background: "#e0e0e0", padding: "1px 8px", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-system)" }}>← Back</button>
                      </div>
                      <div style={{ flex: 1, background: "#0d0d0d", position: "relative", minHeight: 0, overflow: "hidden" }}>
                        {vrStarted && <div id="yt-player-root"><div ref={ytDivRef} /></div>}
                        {vrStarted && <div style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "default" }} onClick={handlePlayPause} />}
                        {!vrStarted && (
                          <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px), #0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                            <div onClick={handleFirstPlay} style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #777", background: "radial-gradient(circle at 38% 32%, #5a5a5a, #1a1a1a)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ccc", fontSize: 20, paddingLeft: 4, boxShadow: "0 0 14px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12)" }}>▶</div>
                            <span style={{ color: "#444", fontSize: 9, fontFamily: "var(--font-system)", letterSpacing: "0.14em" }}>CLICK TO PLAY</span>
                          </div>
                        )}
                      </div>
                      <div style={{ background: "linear-gradient(180deg, #c8c8c8 0%, #a0a0a0 50%, #888 100%)", borderTop: "1px solid #555", padding: "4px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}>
                        <button onClick={handlePlayPause} style={{ width: 22, height: 22, borderRadius: 3, border: "1px solid #555", background: "linear-gradient(180deg, #e0e0e0 0%, #b8b8b8 100%)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, color: "#222", flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 1px rgba(0,0,0,0.3)" }}>{vrVideoPlaying ? "■" : "▶"}</button>
                        <div ref={seekBarRef} onMouseDown={handleSeekBarMouseDown} style={{ flex: 1, height: 10, position: "relative", background: "linear-gradient(180deg, #3a3a3a 0%, #555 100%)", borderRadius: 4, border: "1px solid #2a2a2a", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)", cursor: vrStarted ? "pointer" : "default", userSelect: "none", overflow: "visible" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${videoProgress * 100}%`, background: "linear-gradient(90deg, #6aaee0, #4888c8)", borderRadius: 4, overflow: "visible" }}>
                            {vrStarted && <div style={{ position: "absolute", right: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(180deg, #f0f0f0 0%, #c0c0c0 100%)", border: "1px solid #444", boxShadow: "0 1px 3px rgba(0,0,0,0.5)", pointerEvents: "none" }} />}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: "bold", fontFamily: "var(--font-system)", color: "#444", letterSpacing: "0.04em", flexShrink: 0 }}>QT</span>
                        <button onClick={() => toggleSubWinMaximize(win)} title={win.maximized ? "Restore" : "Maximize"} style={{ width: 22, height: 22, borderRadius: 3, border: "1px solid #555", background: "linear-gradient(180deg, #e0e0e0 0%, #b8b8b8 100%)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, color: "#222", flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 1px rgba(0,0,0,0.3)" }}>{win.maximized ? "⊟" : "⊞"}</button>
                      </div>
                    </div>
                  )}

                  {/* My Project */}
                  {win.projectName === "My Project" && (
                    <div style={{ height: "100%", overflowY: "auto" }}>
                      <div style={{ padding: "12px 16px", fontFamily: "var(--font-system)" }}>
                        <h2 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>{PROJECT.title}</h2>
                        <p style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 10, color: "#333" }}>{PROJECT.description}</p>
                        <div style={{ marginBottom: 10 }}>
                          <strong style={{ fontSize: 10, display: "block", marginBottom: 4 }}>Technologies</strong>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {PROJECT.tech.map((t) => (
                              <span key={t} style={{ fontSize: 10, border: "1px solid #999", padding: "1px 5px", background: "#eee" }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        <a href={PROJECT.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#0000CC" }}>View on GitHub →</a>
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
                  title="Print Preview — Resume.pdf"
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
                      title="Print Preview — Resume.pdf"
                      onPositionChange={setPrinterPos}
                      onClose={() => { setPrinterOpen(false); setActiveWindow(null); setPrinterCollapsed(false); setPrinterMaximized(false); }}
                      onCollapse={() => setPrinterCollapsed(c => !c)}
                      onZoom={togglePrinterMaximize}
                    />
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    {/* Frutiger Aero toolbar */}
                    <div style={{
                      background: "linear-gradient(180deg, #a8d8f0 0%, #5ba3dc 45%, #2e75c8 100%)",
                      borderBottom: "1px solid #1a5a9e",
                      padding: "5px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 2px rgba(0,0,60,0.2)",
                      flexShrink: 0,
                    }}>
                      <img src="/printer.png" width={16} height={16} alt="" style={{ imageRendering: "pixelated" }} />
                      <span style={{
                        color: "white",
                        fontSize: 11,
                        fontWeight: "bold",
                        fontFamily: "var(--font-system)",
                        textShadow: "0 1px 2px rgba(0,0,60,0.5)",
                        letterSpacing: "0.01em",
                      }}>
                        Resume.pdf — Print Preview
                      </span>
                    </div>

                    {/* PDF viewer */}
                    <div style={{ flex: 1, overflow: "hidden", background: "#6b7c8a", minHeight: 0 }}>
                      <iframe
                        src="/Erica (Kela) Liu Resume.pdf#toolbar=0&navpanes=0&scrollbar=0"
                        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                        title="Resume PDF Preview"
                      />
                    </div>

                    {/* Frutiger Aero bottom bar */}
                    <div style={{
                      background: "linear-gradient(180deg, #dff0fa 0%, #b8d8f0 100%)",
                      borderTop: "1px solid #8ab8d8",
                      padding: "6px 10px",
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      flexShrink: 0,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                    }}>
                      <a
                        href="/Erica (Kela) Liu Resume.pdf"
                        download="Erica (Kela) Liu Resume.pdf"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 16px",
                          borderRadius: 12,
                          background: "linear-gradient(180deg, #7cc4f8 0%, #3a90e8 48%, #1a68cc 100%)",
                          boxShadow: "0 2px 4px rgba(0,0,80,0.3), inset 0 1px 0 rgba(255,255,255,0.55)",
                          border: "1px solid #1050a8",
                          color: "white",
                          fontSize: 11,
                          fontWeight: "bold",
                          fontFamily: "var(--font-system)",
                          textDecoration: "none",
                          textShadow: "0 1px 1px rgba(0,0,60,0.45)",
                          cursor: "pointer",
                          letterSpacing: "0.01em",
                        }}
                      >
                        ↓ Download
                      </a>
                    </div>
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
