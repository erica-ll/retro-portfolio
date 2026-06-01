"use client";

import { useState, useEffect } from "react";
import {
  MenuBar,
  MenuItem,
  Window,
  IconButton,
} from "@liiift-studio/mac-os9-ui";

// ─── Monitor frame geometry ───────────────────────────────────────────────────
// desk-full-clean.png is 1718 × 1306.
//
// ┌─ Adjust frame size ──────────────────────────────────────────────────────┐
// │  MONITOR_RATIO  – image aspect ratio; keeps the frame proportional.      │
// │  In the JSX below, change  width: "100vw"  to e.g. "80vw" to shrink,   │
// │  or "110vw" to enlarge (clips slightly off-screen).                      │
// └──────────────────────────────────────────────────────────────────────────┘
const MONITOR_RATIO = 1405 / 1290; // ≈ 1.0891

// Screen-hole position inside the frame image (percentages of frame size).
// Tweak these if the desktop doesn't line up with the physical bezel.
const SCREEN = { left: "15.02%", top: "14.34%", width: "70.88%", height: "59.38%" };

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

function AppleLogo() {
  // TODO: Change this to actual icon
  return (
    <svg width="14" height="14" viewBox="0 0 14 16" fill="currentColor">
      <path d="M9.5 1.5C10.2 0.7 10.5 0 10.5 0c-1.7 0.1-3 1-3.7 2-.6.9-.9 1.8-.8 2.7 1.7 0 3-.9 3.5-3.2zM11.8 8.3c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.7-2.8-.7C3.1 3.6 1.3 4.8.7 6.7c-1.3 3.8.9 9.4 2.7 12.5.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9 1.6 0 2 .9 3.5.9 1.4 0 2.4-1.3 3.2-2.6.7-1 1.3-2.1 1.7-3.2-2-.8-3.4-2.8-3.4-5.3l-.5-.5z" />
    </svg>
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

export default function Home() {
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [folderItemSelected, setFolderItemSelected] = useState(false);
  const [activeWindow, setActiveWindow] = useState<"documents" | "project" | null>(null);
  const [documentsSize, setDocumentsSize] = useState({ width: 380, height: 260 });
  const [projectSize, setProjectSize] = useState({ width: 340, height: 240 });
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const clearSelection = () => setSelectedIcon(null);

  const openDocuments = () => {
    setDocumentsOpen(true);
    setActiveWindow("documents");
    setSelectedIcon(null);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#111",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Monitor — change width below to resize the frame */}
      <div
        style={{
          position: "relative",
          width: "95vw",
          height: `calc(90vw / ${MONITOR_RATIO})`,
          marginTop: "15vh",
        }}
      >
        {/* ── OS 9 desktop — positioned to sit exactly in the screen hole ── */}
        <div
          onClick={() => {
            clearSelection();
            setFolderItemSelected(false);
          }}
          style={{
            position: "absolute",
            left: SCREEN.left,
            top: SCREEN.top,
            width: SCREEN.width,
            height: SCREEN.height,
            background:
              "linear-gradient(160deg, #1463CF 0%, #2070DD 40%, #1756B8 100%)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {/* Menu bar */}
          <MenuBar
            menus={MENUS}
            leftContent={<AppleLogo />}
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
                src="/finder.png"
                label="Macintosh HD"
                selected={selectedIcon === "finder"}
                onSelect={() => setSelectedIcon("finder")}
              />
              <DesktopIcon
                src="/folder.png"
                label="Documents"
                selected={selectedIcon === "documents"}
                onSelect={() => setSelectedIcon("documents")}
                onOpen={openDocuments}
              />
              <DesktopIcon
                src="/printer.png"
                label="Printer"
                selected={selectedIcon === "printer"}
                onSelect={() => setSelectedIcon("printer")}
              />
              <DesktopIcon
                src="/trash.png"
                label="Trash"
                selected={selectedIcon === "trash"}
                onSelect={() => setSelectedIcon("trash")}
              />
            </div>

            {/* Documents window */}
            {documentsOpen && (
              <div onMouseDown={() => setActiveWindow("documents")} style={{ display: "contents" }}>
                <Window
                  title="Documents"
                  active={activeWindow === "documents"}
                  draggable
                  resizable
                  defaultPosition={{ x: 40, y: 30 }}
                  width={documentsSize.width}
                  height={documentsSize.height}
                  onResize={(size) => setDocumentsSize(size)}
                  onClose={() => {
                    setDocumentsOpen(false);
                    setActiveWindow(null);
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      icon={<FolderIcon selected={folderItemSelected} />}
                      label={PROJECT.title}
                      labelPosition="bottom"
                      size="lg"
                      style={{ background: "transparent", border: "none", boxShadow: "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderItemSelected(true);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setProjectOpen(true);
                        setActiveWindow("project");
                      }}
                    />
                  </div>
                </Window>
              </div>
            )}

            {/* Project detail window */}
            {projectOpen && (
              <div onMouseDown={() => setActiveWindow("project")} style={{ display: "contents" }}>
              <Window
                title={PROJECT.title}
                active={activeWindow === "project"}
                draggable
                resizable
                defaultPosition={{ x: 90, y: 70 }}
                width={projectSize.width}
                height={projectSize.height}
                onResize={(size) => setProjectSize(size)}
                onClose={() => {
                  setProjectOpen(false);
                  setActiveWindow(documentsOpen ? "documents" : null);
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    fontFamily: "var(--font-system)",
                  }}
                >
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      marginBottom: 6,
                    }}
                  >
                    {PROJECT.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 11,
                      lineHeight: 1.6,
                      marginBottom: 10,
                      color: "#333",
                    }}
                  >
                    {PROJECT.description}
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <strong
                      style={{
                        fontSize: 10,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Technologies
                    </strong>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {PROJECT.tech.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            border: "1px solid #999",
                            padding: "1px 5px",
                            background: "#eee",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={PROJECT.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 10, color: "#0000CC" }}
                  >
                    View on GitHub →
                  </a>
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
          }}
        />
      </div>
    </div>
  );
}
