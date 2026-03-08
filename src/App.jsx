import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  signInWithGoogle,
  logOut,
  onAuth,
  subscribeUsers,
  updateUserRole,
  deleteUser as deleteUserDoc,
  subscribeEmployees,
  addEmployeeDoc,
  deleteEmployeeDoc,
  subscribeProjects,
  addProjectDoc,
  updateProjectDoc,
  deleteProjectDoc,
  subscribeTeams,
  addTeamDoc,
  updateTeamDoc,
  deleteTeamDoc,
  subscribeTaskTemplates,
  updateTaskTemplates,
  subscribeBranding,
  updateBranding,
  ALLOWED_DOMAIN,
} from "../firebase";

const ROLES = {
  owner: { label: "Owner", color: "#7c4dff", bg: "#ede7f6" },
  manager: { label: "Manager", color: "#0288d1", bg: "#e1f5fe" },
  employee: { label: "Employee", color: "#43a047", bg: "#e8f5e9" },
};

const PERMISSIONS = {
  owner: {
    createProject: true,
    editProject: true,
    deleteProject: true,
    createTask: true,
    editAnyTask: true,
    deleteTask: true,
    manageTeam: true,
    manageRoles: true,
    viewMaster: true,
    viewAllProjects: true,
  },
  manager: {
    createProject: true,
    editProject: true,
    deleteProject: true,
    createTask: true,
    editAnyTask: true,
    deleteTask: true,
    manageTeam: true,
    manageRoles: false,
    viewMaster: true,
    viewAllProjects: true,
  },
  employee: {
    createProject: false,
    editProject: false,
    deleteProject: false,
    createTask: true,
    editAnyTask: false,
    deleteTask: false,
    manageTeam: false,
    manageRoles: false,
    viewMaster: false,
    viewAllProjects: false,
  },
};

const PRIORITY_COLORS = {
  trivial: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  low: { bg: "#e3f2fd", text: "#1565c0", dot: "#42a5f5" },
  medium: { bg: "#e8f5e9", text: "#2e7d32", dot: "#4caf50" },
  high: { bg: "#fff3e0", text: "#e65100", dot: "#ff9800" },
  critical: { bg: "#fce4ec", text: "#c62828", dot: "#ef5350" },
};

const EFFORT_LABELS = {
  easy: "Easy",
  light: "Light",
  moderate: "Moderate",
  some_effort: "Some Effort",
  large: "Large",
  epic: "Epic",
};

const EFFORT_COLORS = {
  easy: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  light: { bg: "#e3f2fd", text: "#1565c0", dot: "#42a5f5" },
  moderate: { bg: "#e8f5e9", text: "#2e7d32", dot: "#4caf50" },
  some_effort: { bg: "#fff3e0", text: "#e65100", dot: "#ff9800" },
  large: { bg: "#fce4ec", text: "#c62828", dot: "#ef5350" },
  epic: { bg: "#f3e5f5", text: "#6a1b9a", dot: "#ab47bc" },
};

const STATUS_LABELS = {
  not_started: "Not Started",
  backlog: "Backlog",
  paused: "Paused",
  in_progress: "In Progress",
  staging: "Staging",
  client_review: "Client Review",
  done: "Done",
};

const STATUS_COLORS = {
  not_started: "#9c7c78",
  backlog: "#90a4ae",
  paused: "#8d6e63",
  in_progress: "#42a5f5",
  staging: "#f9a825",
  client_review: "#7c4dff",
  done: "#66bb6a",
};

const STATUS_DOT_STYLE = {
  not_started: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "2px dotted #90a4ae",
    background: "transparent",
    boxSizing: "border-box",
  },
  backlog: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    border: "2px dotted #90a4ae",
    background: "transparent",
    boxSizing: "border-box",
  },
  paused: { width: 8, height: 8, borderRadius: "50%", background: "#8d6e63" },
  in_progress: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#42a5f5",
  },
  staging: { width: 8, height: 8, borderRadius: "50%", background: "#f9a825" },
  client_review: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#7c4dff",
  },
  done: { width: 8, height: 8, borderRadius: "50%", background: "#66bb6a" },
};

const STATUS_GROUPS = {
  "Not Started": ["not_started", "backlog"],
  Active: ["paused", "in_progress", "staging", "client_review"],
  Closed: ["done"],
};

const STATUS_GROUP_COLORS = {
  "Not Started": "#78909c",
  Active: "#42a5f5",
  Closed: "#66bb6a",
};

const PROJECT_STATUS_LABELS = {
  active_lead: "Active Lead",
  not_started: "Not Started",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
  failed_lead: "Failed Lead",
};

const PROJECT_STATUS_COLORS = {
  active_lead: "#3b82f6",
  not_started: "#cbd5e1",
  active: "#22c55e",
  paused: "#8d6e63",
  closed: "#1e293b",
  failed_lead: "#64748b",
};

const TASK_TYPES = {
  bug: { color: "#ef4444", bg: "#fef2f2", label: "Bug" },
  onboarding: { color: "#f97316", bg: "#fff7ed", label: "Onboarding" },
  followup: { color: "#eab308", bg: "#fefce8", label: "Followup" },
  feature: { color: "#22c55e", bg: "#f0fdf4", label: "Feature" },
  design: { color: "#3b82f6", bg: "#eff6ff", label: "Design" },
  research: { color: "#8b5cf6", bg: "#f5f3ff", label: "Research" },
  content: { color: "#ec4899", bg: "#fdf2f8", label: "Content" },
  seo: { color: "#06b6d4", bg: "#ecfeff", label: "SEO" },
  misc: { color: "#64748b", bg: "#f8fafc", label: "Misc" },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d =
    typeof ts === "string" && ts.includes("-")
      ? new Date(ts + "T00:00:00")
      : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Persistent Storage Hook ───
// ─── UI Primitives ───
function Modal({
  title,
  onClose,
  children,
  width = 520,
  preventClickaway = false,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={preventClickaway ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width,
          maxWidth: "94vw",
          maxHeight: "88vh",
          overflow: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e9ecef",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
            borderRadius: "14px 14px 0 0",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "#1a1a2e",
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#94a3b8",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            marginBottom: 5,
          }}
        >
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: "100%",
          padding: "9px 12px",
          border: "2px solid #e2e8f0",
          borderRadius: 9,
          fontSize: 13,
          outline: "none",
          transition: "border 0.2s",
          boxSizing: "border-box",
          fontFamily: "inherit",
          ...(props.style || {}),
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#6366f1";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#e2e8f0";
          props.onBlur?.(e);
        }}
      />
    </div>
  );
}

function RichTextEditor({ label, value, onChange, readOnly = false }) {
  const editorRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = value || "";
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && (readOnly || !focused)) {
      const current = editorRef.current.innerHTML;
      if (current !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value, focused, readOnly]);

  const handleInput = () => {
    if (editorRef.current && onChange) {
      const html = editorRef.current.innerHTML;
      onChange(html === "<br>" || html === "<div><br></div>" ? "" : html);
    }
  };

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  const isActive = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const ToolBtn = ({ command, icon, title }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        exec(command);
      }}
      style={{
        width: 30,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: "none",
        borderRadius: 5,
        cursor: "pointer",
        color: "#475569",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        e.target.style.background = "#e2e8f0";
      }}
      onMouseLeave={(e) => {
        e.target.style.background = "none";
      }}
    >
      {icon}
    </button>
  );

  const insertLink = (e) => {
    e.preventDefault();
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            marginBottom: 5,
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          border: readOnly
            ? "none"
            : `2px solid ${focused ? "#6366f1" : "#e2e8f0"}`,
          borderRadius: 9,
          overflow: "hidden",
          transition: "border 0.2s",
          background: "#fff",
        }}
      >
        {!readOnly && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "6px 8px",
              borderBottom: "1px solid #e9ecef",
              background: "#f8fafc",
              flexWrap: "wrap",
            }}
          >
            <ToolBtn command="bold" icon={<b>B</b>} title="Bold" />
            <ToolBtn command="italic" icon={<i>I</i>} title="Italic" />
            <ToolBtn command="underline" icon={<u>U</u>} title="Underline" />
            <ToolBtn
              command="strikeThrough"
              icon={<s>S</s>}
              title="Strikethrough"
            />
            <div
              style={{
                width: 1,
                height: 18,
                background: "#d1d5db",
                margin: "0 4px",
              }}
            />
            <ToolBtn
              command="insertUnorderedList"
              icon="•"
              title="Bullet list"
            />
            <ToolBtn
              command="insertOrderedList"
              icon="1."
              title="Numbered list"
            />
            <div
              style={{
                width: 1,
                height: 18,
                background: "#d1d5db",
                margin: "0 4px",
              }}
            />
            <button
              type="button"
              title="Insert link"
              onMouseDown={insertLink}
              style={{
                width: 30,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
                color: "#475569",
                fontSize: 13,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "none";
              }}
            >
              🔗
            </button>
            <div
              style={{
                width: 1,
                height: 18,
                background: "#d1d5db",
                margin: "0 4px",
              }}
            />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  exec("formatBlock", e.target.value);
                  e.target.value = "";
                }
              }}
              style={{
                fontSize: 12,
                padding: "3px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: 5,
                background: "#fff",
                fontFamily: "inherit",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <option value="">Heading...</option>
              <option value="h2">Heading 1</option>
              <option value="h3">Heading 2</option>
              <option value="h4">Heading 3</option>
              <option value="p">Paragraph</option>
            </select>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              title="Clear formatting"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("removeFormat");
              }}
              style={{
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 8px",
                background: "none",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "none";
              }}
            >
              Clear
            </button>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) {
              const a = e.target.closest("a");
              if (a?.href) {
                e.preventDefault();
                window.open(a.href, "_blank", "noopener");
              }
            }
          }}
          data-placeholder="Add description about this client..."
          style={{
            minHeight: readOnly ? "auto" : 120,
            maxHeight: 300,
            overflowY: "auto",
            padding: "10px 14px",
            fontSize: 13,
            lineHeight: 1.7,
            color: "#1e293b",
            outline: "none",
            fontFamily: "inherit",
            wordBreak: "break-word",
          }}
        />
        <style>{`
          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            pointer-events: none;
          }
          [contenteditable] h2 { font-size: 18px; font-weight: 700; margin: 8px 0 4px; color: #1e293b; }
          [contenteditable] h3 { font-size: 15px; font-weight: 700; margin: 8px 0 4px; color: #1e293b; }
          [contenteditable] h4 { font-size: 13px; font-weight: 700; margin: 6px 0 2px; color: #475569; }
          [contenteditable] ul, [contenteditable] ol { margin: 4px 0; padding-left: 22px; }
          [contenteditable] li { margin: 2px 0; }
          [contenteditable] a { color: #6366f1; text-decoration: underline; }
          [contenteditable] p { margin: 4px 0; }
        `}</style>
      </div>
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            marginBottom: 5,
          }}
        >
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          width: "100%",
          padding: "9px 12px",
          border: "2px solid #e2e8f0",
          borderRadius: 9,
          fontSize: 13,
          outline: "none",
          background: "#fff",
          fontFamily: "inherit",
          boxSizing: "border-box",
          ...(props.style || {}),
        }}
      >
        {children}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", size = "md", ...props }) {
  const styles = {
    primary: { background: "#6366f1", color: "#fff", border: "none" },
    secondary: {
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
    },
    danger: {
      background: "#fee2e2",
      color: "#dc2626",
      border: "1px solid #fecaca",
    },
    ghost: { background: "transparent", color: "#64748b", border: "none" },
  };
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "10px 18px", fontSize: 14 },
  };
  return (
    <button
      {...props}
      style={{
        ...styles[variant],
        ...sizes[size],
        borderRadius: 8,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function Badge({ color, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        background: color + "18",
        color,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: color }}
      />
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = status || "not_started";
  const dotStyle = STATUS_DOT_STYLE[s] || STATUS_DOT_STYLE.not_started;
  const color = STATUS_COLORS[s] || STATUS_COLORS.not_started;
  const label = STATUS_LABELS[s] || s;
  const isUnfilled = s === "not_started" || s === "backlog";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        background: color + "18",
        color,
      }}
    >
      <span
        style={{
          ...dotStyle,
          width: 6,
          height: 6,
          flexShrink: 0,
          ...(isUnfilled
            ? { border: `1.5px dotted ${color}`, background: "transparent" }
            : {}),
        }}
      />
      {label}
    </span>
  );
}

function StatusDot({ status, size = 8 }) {
  const s = status || "not_started";
  const isUnfilled = s === "not_started" || s === "backlog";
  const color = STATUS_COLORS[s] || STATUS_COLORS.not_started;
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        boxSizing: "border-box",
        ...(isUnfilled
          ? {
              border: `${Math.max(1.5, size / 5)}px dotted ${color}`,
              background: "transparent",
            }
          : { background: color }),
      }}
    />
  );
}

function StatusSelect({ value, onChange, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = value || "not_started";

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropHeight = 310;
      const openAbove = spaceBelow < dropHeight && rect.top > dropHeight;
      setPos({
        top: openAbove ? rect.top - dropHeight - 4 : rect.bottom + 4,
        left: rect.left,
        openAbove,
      });
    }
    setOpen((o) => !o);
  };

  const isSm = size === "sm";
  const padding = isSm ? "3px 8px 3px 6px" : "5px 10px 5px 8px";
  const fontSize = isSm ? 11 : 12;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding,
          fontSize,
          fontWeight: 500,
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          background: "#fff",
          cursor: "pointer",
          fontFamily: "inherit",
          color: "#1e293b",
          whiteSpace: "nowrap",
        }}
      >
        <StatusDot status={current} size={isSm ? 7 : 8} />
        <span>{STATUS_LABELS[current] || current}</span>
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: 180,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            maxHeight: 310,
            overflowY: "auto",
          }}
        >
          {Object.entries(STATUS_GROUPS).map(([group, statuses]) => (
            <div key={group}>
              <div
                style={{
                  padding: "8px 12px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "#94a3b8",
                }}
              >
                {group}
              </div>
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "7px 14px",
                    border: "none",
                    background: current === s ? "#f1f5f9" : "transparent",
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                    color: "#1e293b",
                    textAlign: "left",
                    fontWeight: current === s ? 600 : 400,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (current !== s)
                      e.currentTarget.style.background = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (current !== s)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <StatusDot status={s} size={8} />
                  <span>{STATUS_LABELS[s]}</span>
                  {current === s && (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "#6366f1",
                        fontSize: 13,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FormSection({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "#94a3b8",
        marginTop: 18,
        marginBottom: 8,
        paddingTop: 14,
        borderTop: "1px solid #f1f5f9",
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, isLink }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 0",
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: "#94a3b8",
          fontSize: 14,
          width: 18,
          textAlign: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          color: "#64748b",
          minWidth: 90,
          flexShrink: 0,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      {isLink ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#6366f1",
            textDecoration: "none",
            wordBreak: "break-all",
            fontWeight: 500,
          }}
        >
          {value}
        </a>
      ) : (
        <span style={{ color: "#1e293b", wordBreak: "break-word" }}>
          {value}
        </span>
      )}
    </div>
  );
}

// ─── Due Date Helper ───
function DueDateLabel({ dueDate }) {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  if (isNaN(d)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  let color = "#64748b";
  let text = fmtDate(dueDate);
  if (diff < 0) {
    color = "#ef4444";
    text = `Overdue · ${fmtDate(dueDate)}`;
  } else if (diff === 0) {
    color = "#f59e0b";
    text = "Due today";
  } else if (diff === 1) {
    color = "#f59e0b";
    text = "Due tomorrow";
  } else if (diff <= 3) {
    color = "#f59e0b";
    text = `Due in ${diff} days`;
  }
  return (
    <span style={{ fontSize: 11, color, fontWeight: 500 }}>📅 {text}</span>
  );
}

// ─── Editable Text ───
function EditableText({ value, onChange, style: sx }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        style={{
          width: "100%",
          padding: "4px 8px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          border: "1.5px solid #6366f1",
          borderRadius: 6,
          outline: "none",
          background: "#fff",
          boxSizing: "border-box",
          color: "#1e293b",
          ...sx,
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        fontWeight: 600,
        cursor: "text",
        padding: "4px 8px",
        borderRadius: 6,
        border: "1.5px solid transparent",
        transition: "all 0.15s",
        ...sx,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.background = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "transparent";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {value}
    </div>
  );
}

// ─── Task Detail Modal ───
function TaskDetailModal({
  task,
  project,
  allUsers,
  currentUser,
  onUpdate,
  onClose,
  canEdit,
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [comment, setComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const activities = task.activities || [];
  const comments = task.comments || [];
  const subtasks = task.subtasks || [];

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    const sub = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: text,
      done: false,
    };
    onUpdate(task.id, { subtasks: [...subtasks, sub] });
    setNewSubtask("");
  };
  const toggleSubtask = (subId) => {
    const updated = subtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s,
    );
    onUpdate(task.id, { subtasks: updated });
  };
  const deleteSubtask = (subId) => {
    onUpdate(task.id, { subtasks: subtasks.filter((s) => s.id !== subId) });
  };

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed });
    }
  };

  const saveDescription = (html) => {
    setDescription(html);
    onUpdate(task.id, { description: html });
  };

  const addComment = () => {
    if (!comment.trim()) return;
    const newComment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      text: comment.trim(),
      userId: currentUser.id,
      userName: currentUser.name,
      userPhoto: currentUser.photoURL || null,
      createdAt: Date.now(),
    };
    onUpdate(task.id, { comments: [...comments, newComment] });
    setComment("");
  };

  const timeline = [
    ...activities.map((a) => ({ ...a, type: "activity" })),
    ...comments.map((c) => ({ ...c, type: "comment", createdAt: c.createdAt })),
  ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const assignee = allUsers.find((u) => u.id === task.assignee);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: 960,
          maxWidth: "96vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e9ecef",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {project && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6366f1",
                  background: "#eef2ff",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {project.name}
              </span>
            )}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Created {fmtDate(task.createdAt)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#94a3b8",
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Body — two columns */}
        <div
          style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
        >
          {/* Left: Task details */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {/* Title */}
            {canEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                }}
                style={{
                  width: "100%",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1e293b",
                  border: "none",
                  borderBottom: "2px solid transparent",
                  outline: "none",
                  padding: "4px 0",
                  fontFamily: "inherit",
                  background: "transparent",
                  marginBottom: 16,
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderBottomColor = "#6366f1")}
                onBlurCapture={(e) =>
                  (e.target.style.borderBottomColor = "transparent")
                }
              />
            ) : (
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                {task.title}
              </h2>
            )}

            {/* Meta fields */}
            {(() => {
              const fieldLabel = {
                fontSize: 11,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              };
              const fieldVal = {
                fontSize: 13,
                fontWeight: 600,
                color: "#1e293b",
              };
              const assigneeSelect = {
                width: "100%",
                padding: "6px 8px",
                fontSize: 13,
                fontWeight: 600,
                color: "#1e293b",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                background: "#fff",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
              };
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 20,
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <div style={fieldLabel}>Status</div>
                    {canEdit ? (
                      <StatusSelect
                        value={task.status || "not_started"}
                        onChange={(v) => onUpdate(task.id, { status: v })}
                      />
                    ) : (
                      <StatusBadge status={task.status} />
                    )}
                  </div>
                  <div>
                    <div style={fieldLabel}>Priority</div>
                    {canEdit ? (
                      <PrioritySelect
                        value={task.priority || "medium"}
                        onChange={(v) => onUpdate(task.id, { priority: v })}
                      />
                    ) : (
                      <Badge
                        color={PRIORITY_COLORS[task.priority || "medium"]?.dot}
                        label={task.priority || "medium"}
                      />
                    )}
                  </div>
                  <div>
                    <div style={fieldLabel}>Effort</div>
                    {canEdit ? (
                      <EffortSelect
                        value={task.effort || ""}
                        onChange={(v) => onUpdate(task.id, { effort: v })}
                      />
                    ) : task.effort && EFFORT_COLORS[task.effort] ? (
                      <Badge
                        color={EFFORT_COLORS[task.effort].dot}
                        label={EFFORT_LABELS[task.effort]}
                      />
                    ) : (
                      <span style={fieldVal}>—</span>
                    )}
                  </div>
                  {/* Task Type */}
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      Task Type
                    </div>
                    {canEdit ? (
                      <TaskTypeSelect
                        value={task.taskType || ""}
                        onChange={(v) =>
                          onUpdate(task.id, { taskType: v || null })
                        }
                      />
                    ) : (
                      (() => {
                        const tt = TASK_TYPES[task.taskType];
                        return tt ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              background: tt.bg,
                              color: tt.color,
                              border: `1px solid ${tt.color}22`,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: tt.color,
                              }}
                            />
                            {tt.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: "#94a3b8" }}>
                            —
                          </span>
                        );
                      })()
                    )}
                  </div>

                  <div>
                    <div style={fieldLabel}>Due Date</div>
                    {canEdit ? (
                      <DateCell
                        value={task.dueDate || ""}
                        onChange={(v) => onUpdate(task.id, { dueDate: v })}
                      />
                    ) : (
                      <DueDateLabel dueDate={task.dueDate} />
                    )}
                  </div>
                  <div>
                    <div style={fieldLabel}>Assignee</div>
                    {canEdit ? (
                      <select
                        value={task.assignee || ""}
                        onChange={(e) =>
                          onUpdate(task.id, { assignee: e.target.value })
                        }
                        style={assigneeSelect}
                      >
                        <option value="">Unassigned</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={fieldVal}>
                        {assignee ? assignee.name : "Unassigned"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Description */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: 8,
                }}
              >
                Description
              </div>
              {canEdit ? (
                <RichTextEditor
                  value={description}
                  onChange={saveDescription}
                />
              ) : (
                <div
                  style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{
                    __html:
                      description ||
                      "<span style='color:#94a3b8'>No description</span>",
                  }}
                />
              )}
            </div>

            {/* Subtasks */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}
                >
                  Subtasks
                  {subtasks.length > 0 && (
                    <span
                      style={{
                        fontWeight: 400,
                        color: "#94a3b8",
                        marginLeft: 6,
                        fontSize: 12,
                      }}
                    >
                      {subtasks.filter((s) => s.done).length}/{subtasks.length}
                    </span>
                  )}
                </div>
              </div>
              {subtasks.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: 4,
                      background: "#f1f5f9",
                      borderRadius: 2,
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${subtasks.length > 0 ? (subtasks.filter((s) => s.done).length / subtasks.length) * 100 : 0}%`,
                        background: "#22c55e",
                        borderRadius: 2,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  {subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid #f8fafc",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!sub.done}
                        onChange={() => toggleSubtask(sub.id)}
                        style={{
                          cursor: "pointer",
                          accentColor: "#22c55e",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: sub.done ? "#94a3b8" : "#1e293b",
                          textDecoration: sub.done ? "line-through" : "none",
                        }}
                      >
                        {sub.title}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deleteSubtask(sub.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#cbd5e1",
                            fontSize: 14,
                            padding: "2px 4px",
                            lineHeight: 1,
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.color = "#cbd5e1")
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                    placeholder="Add a subtask..."
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      fontSize: 13,
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      outline: "none",
                      fontFamily: "inherit",
                      color: "#1e293b",
                    }}
                  />
                  <button
                    onClick={addSubtask}
                    style={{
                      padding: "7px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#f1f5f9",
                      color: "#475569",
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Activity & Comments */}
          <div
            style={{
              width: 360,
              borderLeft: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              background: "#fafbfc",
            }}
          >
            <div
              style={{
                padding: "16px 18px 8px",
                fontSize: 13,
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Activity
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 18px 12px",
              }}
            >
              {timeline.length === 0 ? (
                <div
                  style={{
                    padding: "24px 0",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  No activity yet
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
                  {timeline.map((item, i) => (
                    <div
                      key={item.id || i}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom:
                          i < timeline.length - 1
                            ? "1px solid #f1f5f9"
                            : "none",
                      }}
                    >
                      {item.type === "comment" ? (
                        <>
                          {item.userPhoto ? (
                            <img
                              src={item.userPhoto}
                              alt=""
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                background: "#eef2ff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#6366f1",
                                flexShrink: 0,
                              }}
                            >
                              {item.userName?.[0] || "?"}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, marginBottom: 3 }}>
                              <strong style={{ color: "#1e293b" }}>
                                {item.userName}
                              </strong>
                              <span
                                style={{
                                  color: "#94a3b8",
                                  marginLeft: 6,
                                  fontSize: 11,
                                }}
                              >
                                {formatTime(item.createdAt)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#334155",
                                lineHeight: 1.5,
                                background: "#fff",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #e9ecef",
                                wordBreak: "break-word",
                              }}
                              dangerouslySetInnerHTML={{
                                __html: item.text
                                  .replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;")
                                  .replace(
                                    /(https?:\/\/[^\s<]+)/g,
                                    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline">$1</a>'
                                  ),
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 7,
                              background: "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            ↻
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                                lineHeight: 1.6,
                              }}
                            >
                              <strong style={{ color: "#1e293b" }}>
                                {item.userName || "System"}
                              </strong>{" "}
                              {item.message}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {formatTime(item.createdAt)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Comment input */}
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid #e9ecef",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && addComment()
                  }
                  placeholder="Add a comment..."
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    outline: "none",
                    fontFamily: "inherit",
                    color: "#1e293b",
                  }}
                />
                <button
                  onClick={addComment}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Priority Select ───
function PrioritySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = value || "medium";
  const pri = PRIORITY_COLORS[current];

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPos({
        top: spaceBelow < 140 ? rect.top - 140 : rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen((o) => !o);
  };

  const options = [
    { key: "trivial", label: "Trivial", color: PRIORITY_COLORS.trivial },
    { key: "low", label: "Low", color: PRIORITY_COLORS.low },
    { key: "medium", label: "Medium", color: PRIORITY_COLORS.medium },
    { key: "high", label: "High", color: PRIORITY_COLORS.high },
    { key: "critical", label: "Critical", color: PRIORITY_COLORS.critical },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 7,
          border: "1px solid #e2e8f0",
          background: pri.bg || "#f1f5f9",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color: pri.text || "#475569",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: pri.dot,
          }}
        />
        {current}
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: 130,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: current === o.key ? "#f1f5f9" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                color: "#1e293b",
                textAlign: "left",
                fontWeight: current === o.key ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: o.color.dot,
                }}
              />
              <span>{o.label}</span>
              {current === o.key && (
                <span
                  style={{ marginLeft: "auto", color: "#6366f1", fontSize: 13 }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Task Type Select ───
function TaskTypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = value || "";
  const tt = TASK_TYPES[current];

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPos({
        top: spaceBelow < 200 ? rect.top - 200 : rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 7,
          border: "1px solid #e2e8f0",
          background: tt ? tt.bg : "#f8fafc",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color: tt ? tt.color : "#94a3b8",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: tt ? tt.color : "#cbd5e1",
          }}
        />
        {tt ? tt.label : "None"}
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: 150,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "9px 14px",
              border: "none",
              background: !current ? "#f1f5f9" : "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              color: "#94a3b8",
              textAlign: "left",
              fontWeight: !current ? 600 : 400,
              fontStyle: "italic",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => {
              if (current) e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (current) e.currentTarget.style.background = "transparent";
            }}
          >
            None
            {!current && (
              <span
                style={{ marginLeft: "auto", color: "#6366f1", fontSize: 13 }}
              >
                ✓
              </span>
            )}
          </button>
          {Object.entries(TASK_TYPES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: current === key ? "#f1f5f9" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                color: "#1e293b",
                textAlign: "left",
                fontWeight: current === key ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (current !== key)
                  e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (current !== key)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: t.color,
                }}
              />
              <span>{t.label}</span>
              {current === key && (
                <span
                  style={{ marginLeft: "auto", color: "#6366f1", fontSize: 13 }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Effort Select ───
function EffortSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = value || "moderate";
  const eff = EFFORT_COLORS[current] || EFFORT_COLORS.moderate;

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPos({
        top: spaceBelow < 200 ? rect.top - 200 : rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen((o) => !o);
  };

  const options = Object.entries(EFFORT_LABELS).map(([key, label]) => ({
    key,
    label,
    color: EFFORT_COLORS[key],
  }));

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 7,
          border: "1px solid #e2e8f0",
          background: eff.bg,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color: eff.text,
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: eff.dot,
          }}
        />
        {EFFORT_LABELS[current] || current}
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: 150,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: current === o.key ? "#f1f5f9" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                color: "#1e293b",
                textAlign: "left",
                fontWeight: current === o.key ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: o.color.dot,
                }}
              />
              <span>{o.label}</span>
              {current === o.key && (
                <span
                  style={{ marginLeft: "auto", color: "#6366f1", fontSize: 13 }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Project Status Select ───
function ProjectStatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = value || "not_started";
  const color =
    PROJECT_STATUS_COLORS[current] || PROJECT_STATUS_COLORS.not_started;
  const isUnfilled = current === "not_started";

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPos({
        top: spaceBelow < 200 ? rect.top - 200 : rect.bottom + 4,
        left: rect.left,
      });
    }
    setOpen((o) => !o);
  };

  const options = Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => ({
    key: k,
    label: v,
    color: PROJECT_STATUS_COLORS[k],
    unfilled: k === "not_started",
  }));

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 7,
          border: `1px solid ${color}30`,
          background: color + "15",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color: color,
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            boxSizing: "border-box",
            ...(isUnfilled
              ? { background: "transparent", border: `1.5px solid ${color}` }
              : { background: color }),
          }}
        />
        {PROJECT_STATUS_LABELS[current]}
        <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: 2 }}>▼</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: 160,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: current === o.key ? "#f1f5f9" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                color: "#1e293b",
                textAlign: "left",
                fontWeight: current === o.key ? 600 : 400,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (current !== o.key)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  boxSizing: "border-box",
                  ...(o.unfilled
                    ? {
                        background: "transparent",
                        border: `1.5px solid ${o.color}`,
                      }
                    : { background: o.color }),
                }}
              />
              <span style={{ color: o.color, fontWeight: 600 }}>{o.label}</span>
              {current === o.key && (
                <span
                  style={{ marginLeft: "auto", color: "#6366f1", fontSize: 13 }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Date Cell ───
function DateCell({ value, onChange }) {
  const hasDue = !!value;

  let urgency = null;
  let urgColor = "#64748b";
  let borderColor = "#e2e8f0";
  let bg = "#fff";
  let textColor = "#1e293b";

  if (hasDue) {
    const d = new Date(value + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - now) / 86400000);
    if (diff < 0) {
      urgency = "Overdue";
      urgColor = "#ef4444";
      borderColor = "#fecaca";
      bg = "#fef2f2";
      textColor = "#dc2626";
    } else if (diff === 0) {
      urgency = "Today";
      urgColor = "#f59e0b";
      borderColor = "#fde68a";
      bg = "#fffbeb";
      textColor = "#d97706";
    } else if (diff === 1) {
      urgency = "Tomorrow";
      urgColor = "#f59e0b";
      borderColor = "#fde68a";
      bg = "#fffbeb";
      textColor = "#d97706";
    } else if (diff <= 3) {
      urgency = `${diff}d`;
      urgColor = "#f59e0b";
      borderColor = "#fde68a";
      bg = "#fffbeb";
      textColor = "#d97706";
    } else if (diff <= 7) {
      borderColor = "#bbf7d0";
      bg = "#f0fdf4";
      textColor = "#16a34a";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "5px 8px",
          fontSize: 12,
          fontWeight: hasDue ? 600 : 400,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 7,
          background: bg,
          color: hasDue ? textColor : "#94a3b8",
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
          minWidth: 120,
          transition: "all 0.15s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#6366f1";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = borderColor;
        }}
      />
      {urgency && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: urgColor,
            background: urgColor + "14",
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {urgency}
        </span>
      )}
      {hasDue && (
        <button
          onClick={() => onChange("")}
          style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#cbd5e1",
            fontSize: 13,
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#cbd5e1";
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Task Card ───
function TaskCard({
  task,
  project,
  users,
  onUpdate,
  onDelete,
  isEmployee,
  onOpenDetail,
}) {
  const pri = PRIORITY_COLORS[task.priority || "medium"];
  const assignee = users.find((u) => u.id === task.assignee);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 11,
        padding: 16,
        border: "1px solid #e9ecef",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          onClick={() => onOpenDetail && onOpenDetail(task.id)}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: onOpenDetail ? "#6366f1" : "#1e293b",
            flex: 1,
            lineHeight: 1.4,
            cursor: onOpenDetail ? "pointer" : "default",
          }}
          onMouseEnter={(e) => {
            if (onOpenDetail)
              e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            if (onOpenDetail) e.currentTarget.style.textDecoration = "none";
          }}
        >
          {task.title}
        </span>
        {!isEmployee && (
          <button
            onClick={() => onDelete(task.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#cbd5e1",
              fontSize: 16,
              padding: 2,
            }}
          >
            ×
          </button>
        )}
      </div>
      {task.description && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          {task.description}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <StatusBadge status={task.status} />
        <Badge color={pri.dot} label={task.priority || "medium"} />
        {task.effort &&
          (() => {
            const e = EFFORT_COLORS[task.effort];
            return e ? (
              <Badge color={e.dot} label={EFFORT_LABELS[task.effort]} />
            ) : null;
          })()}
        {project && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6366f1",
              background: "#eef2ff",
              padding: "3px 9px",
              borderRadius: 20,
            }}
          >
            {project.name}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {assignee ? `→ ${assignee.name}` : "Unassigned"}
          </span>
          <DueDateLabel dueDate={task.dueDate} />
        </div>
        <StatusSelect
          value={task.status}
          onChange={(s) => onUpdate(task.id, { status: s })}
          size="sm"
        />
      </div>
    </div>
  );
}

// ─── Project Form Fields (shared between add & edit) ───
function ProjectFormFields({ form, setForm, users }) {
  const f = (key) => form[key] || "";
  const s = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const currentPriority = f("projectPriority") || "medium";
  const currentStatus = f("projectStatus") || "not_started";

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Project / Business Name *"
          placeholder="e.g. Smith's Plumbing"
          value={f("projectName")}
          onChange={s("projectName")}
          autoFocus
        />
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#475569",
              marginBottom: 5,
            }}
          >
            Priority
          </label>
          <PrioritySelect
            value={currentPriority}
            onChange={(v) => setForm({ ...form, projectPriority: v })}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#475569",
              marginBottom: 5,
            }}
          >
            Status
          </label>
          <ProjectStatusSelect
            value={currentStatus}
            onChange={(v) => setForm({ ...form, projectStatus: v })}
          />
        </div>
        <Select
          label="Assignee"
          value={f("projectAssignee") || ""}
          onChange={s("projectAssignee")}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Industry"
        placeholder="e.g. Plumbing, Real Estate, Legal"
        value={f("industry")}
        onChange={s("industry")}
      />

      <FormSection>Key Dates</FormSection>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
      >
        <Input
          label="Website Launch Date"
          type="date"
          value={f("websiteLaunchDate")}
          onChange={s("websiteLaunchDate")}
        />
        <Input
          label="SEO Start Date"
          type="date"
          value={f("seoStartDate")}
          onChange={s("seoStartDate")}
        />
        <Input
          label="Project Closed Date"
          type="date"
          value={f("projectClosedDate")}
          onChange={s("projectClosedDate")}
        />
      </div>

      <FormSection>Point of Contact</FormSection>
      <Input
        label="Name"
        placeholder="e.g. John Smith"
        value={f("pointOfContact")}
        onChange={s("pointOfContact")}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Email"
          placeholder="john@example.com"
          value={f("pocEmail")}
          onChange={s("pocEmail")}
        />
        <Input
          label="Phone"
          placeholder="(555) 123-4567"
          value={f("pocPhone")}
          onChange={s("pocPhone")}
        />
      </div>

      {/* Additional Points of Contact */}
      {(form.additionalContacts || []).map((c, i) => (
        <div
          key={c.id}
          style={{
            marginTop: 10,
            padding: "12px 14px",
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #e9ecef",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Additional Contact #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => {
                const arr = [...(form.additionalContacts || [])];
                arr.splice(i, 1);
                setForm({ ...form, additionalContacts: arr });
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#cbd5e1",
                fontSize: 16,
                padding: "2px 6px",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
            >
              ×
            </button>
          </div>
          <Input
            label="Name"
            placeholder="Contact name"
            value={c.name || ""}
            onChange={(e) => {
              const arr = [...(form.additionalContacts || [])];
              arr[i] = { ...arr[i], name: e.target.value };
              setForm({ ...form, additionalContacts: arr });
            }}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Input
              label="Email"
              placeholder="email@example.com"
              value={c.email || ""}
              onChange={(e) => {
                const arr = [...(form.additionalContacts || [])];
                arr[i] = { ...arr[i], email: e.target.value };
                setForm({ ...form, additionalContacts: arr });
              }}
            />
            <Input
              label="Phone"
              placeholder="(555) 000-0000"
              value={c.phone || ""}
              onChange={(e) => {
                const arr = [...(form.additionalContacts || [])];
                arr[i] = { ...arr[i], phone: e.target.value };
                setForm({ ...form, additionalContacts: arr });
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const arr = [
            ...(form.additionalContacts || []),
            {
              id:
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 6),
              name: "",
              email: "",
              phone: "",
            },
          ];
          setForm({ ...form, additionalContacts: arr });
        }}
        style={{
          marginTop: 8,
          marginBottom: 14,
          background: "none",
          border: "1px dashed #d1d5db",
          borderRadius: 8,
          padding: "7px 14px",
          cursor: "pointer",
          color: "#6366f1",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          width: "100%",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        + Add Another Contact
      </button>

      <FormSection>Business Contact</FormSection>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Business Email"
          placeholder="info@business.com"
          value={f("bizEmail")}
          onChange={s("bizEmail")}
        />
        <Input
          label="Business Phone"
          placeholder="(555) 987-6543"
          value={f("bizPhone")}
          onChange={s("bizPhone")}
        />
      </div>
      <Input
        label="Business Address"
        placeholder="123 Main St, Queens, NY 11375"
        value={f("address")}
        onChange={s("address")}
      />

      <FormSection>Links</FormSection>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Website"
          placeholder="https://example.com"
          value={f("website")}
          onChange={s("website")}
        />
        <Input
          label="Google Doc Link"
          placeholder="https://docs.google.com/..."
          value={f("googleDoc")}
          onChange={s("googleDoc")}
        />
      </div>

      <FormSection>Social Media</FormSection>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="Facebook"
          placeholder="facebook.com/..."
          value={f("facebook")}
          onChange={s("facebook")}
        />
        <Input
          label="Instagram"
          placeholder="@handle"
          value={f("instagram")}
          onChange={s("instagram")}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="LinkedIn"
          placeholder="linkedin.com/in/..."
          value={f("linkedin")}
          onChange={s("linkedin")}
        />
        <Input
          label="X / Twitter"
          placeholder="@handle"
          value={f("twitter")}
          onChange={s("twitter")}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input
          label="YouTube"
          placeholder="youtube.com/..."
          value={f("youtube")}
          onChange={s("youtube")}
        />
        <Input
          label="TikTok"
          placeholder="@handle"
          value={f("tiktok")}
          onChange={s("tiktok")}
        />
      </div>
      <Input
        label="Google Business Profile"
        placeholder="https://g.page/..."
        value={f("gbp")}
        onChange={s("gbp")}
      />

      <FormSection>Description</FormSection>
      <RichTextEditor
        label="Description"
        value={f("notes")}
        onChange={(html) => setForm({ ...form, notes: html })}
      />
    </>
  );
}

// ─── Project Detail Panel ───
function ProjectDetailPanel({ project, users, onEdit, canEdit = true, currentUser, authUser, onAddNote, onDeleteNote, canDelete = false, open, setOpen, notesOpen, setNotesOpen, projNotesOpen, setProjNotesOpen }) {
  const noteRef = useRef(null);
  const [noteBtn, setNoteBtn] = useState(false);
  const projNotes = (project.projectNotes || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  const assignee = users.find((u) => u.id === project.projectAssignee);
  const pri = PRIORITY_COLORS[project.projectPriority || "medium"];
  const hasSocials =
    project.facebook ||
    project.instagram ||
    project.linkedin ||
    project.twitter ||
    project.youtube ||
    project.tiktok ||
    project.gbp;
  const hasPOC =
    project.pointOfContact ||
    project.pocEmail ||
    project.pocPhone ||
    (project.additionalContacts || []).length > 0;
  const hasBizContact =
    project.bizEmail ||
    project.email ||
    project.bizPhone ||
    project.phone ||
    project.address;
  const hasLinks = project.website || project.googleDoc;
  const hasAnyInfo = hasPOC || hasBizContact || hasLinks || hasSocials;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e9ecef",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 22px",
          background: "#fafbfe",
          borderBottom: open ? "1px solid #e9ecef" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          transition: "border 0.2s",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              fontSize: 11,
              color: "#94a3b8",
              transition: "transform 0.25s ease",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Client Details
          </span>
          <Badge
            color={pri.dot}
            label={(project.projectPriority || "medium") + " priority"}
          />
          <Badge
            color={
              PROJECT_STATUS_COLORS[project.projectStatus || "not_started"]
            }
            label={
              PROJECT_STATUS_LABELS[project.projectStatus || "not_started"]
            }
          />
          {assignee && (
            <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
              → {assignee.name}
            </span>
          )}
          {project.industry && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#475569",
                background: "#f1f5f9",
                padding: "3px 9px",
                borderRadius: 20,
              }}
            >
              {project.industry}
            </span>
          )}
          {!open && project.pointOfContact && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              · {project.pointOfContact}
            </span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <Btn variant="secondary" size="sm" onClick={onEdit}>
              Edit Details
            </Btn>
          )}
        </div>
      </div>
      <div
        style={{
          maxHeight: open ? 5000 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        <div
          style={{
            padding: "10px 22px 18px",
            display: "grid",
            gridTemplateColumns: hasAnyInfo ? "1fr 1fr" : "1fr",
            gap: "0 40px",
          }}
        >
          <div>
            {hasPOC && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#94a3b8",
                    marginTop: 6,
                    marginBottom: 4,
                  }}
                >
                  Point of Contact
                </div>
                <InfoRow
                  icon="👤"
                  label="Name"
                  value={project.pointOfContact}
                />
                <InfoRow
                  icon="✉"
                  label="Email"
                  value={project.pocEmail}
                  isLink={project.pocEmail?.includes("@")}
                />
                <InfoRow icon="☎" label="Phone" value={project.pocPhone} />
              </>
            )}
            {(project.additionalContacts || []).length > 0 &&
              (project.additionalContacts || []).map((c, i) => (
                <div key={c.id || i}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      color: "#94a3b8",
                      marginTop: 14,
                      marginBottom: 4,
                    }}
                  >
                    Additional Contact #{i + 1}
                  </div>
                  <InfoRow icon="👤" label="Name" value={c.name} />
                  <InfoRow
                    icon="✉"
                    label="Email"
                    value={c.email}
                    isLink={c.email?.includes("@")}
                  />
                  <InfoRow icon="☎" label="Phone" value={c.phone} />
                </div>
              ))}
            {hasBizContact && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#94a3b8",
                    marginTop: hasPOC ? 14 : 6,
                    marginBottom: 4,
                  }}
                >
                  Business Contact
                </div>
                <InfoRow
                  icon="✉"
                  label="Email"
                  value={project.bizEmail || project.email}
                  isLink={(project.bizEmail || project.email || "").includes(
                    "@",
                  )}
                />
                <InfoRow
                  icon="☎"
                  label="Phone"
                  value={project.bizPhone || project.phone}
                />
                <InfoRow icon="📍" label="Address" value={project.address} />
              </>
            )}
            <InfoRow
              icon="📅"
              label="Added"
              value={fmtDate(project.createdAt)}
            />
            {project.industry && (
              <InfoRow icon="🏢" label="Industry" value={project.industry} />
            )}
            {project.websiteLaunchDate && (
              <InfoRow
                icon="🚀"
                label="Site Launch"
                value={fmtDate(project.websiteLaunchDate)}
              />
            )}
            {project.seoStartDate && (
              <InfoRow
                icon="📈"
                label="SEO Start"
                value={fmtDate(project.seoStartDate)}
              />
            )}
            {project.projectClosedDate && (
              <InfoRow
                icon="🔒"
                label="Closed"
                value={fmtDate(project.projectClosedDate)}
              />
            )}
          </div>
          <div>
            {hasLinks && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#94a3b8",
                    marginTop: 6,
                    marginBottom: 4,
                  }}
                >
                  Links
                </div>
                <InfoRow
                  icon="🌐"
                  label="Website"
                  value={project.website}
                  isLink
                />
                <InfoRow
                  icon="📄"
                  label="Google Doc"
                  value={project.googleDoc}
                  isLink
                />
              </>
            )}
            {hasSocials && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#94a3b8",
                    marginTop: hasLinks ? 14 : 6,
                    marginBottom: 4,
                  }}
                >
                  Social Media
                </div>
                {project.facebook && (
                  <InfoRow
                    icon="f"
                    label="Facebook"
                    value={project.facebook}
                    isLink
                  />
                )}
                {project.instagram && (
                  <InfoRow
                    icon="📷"
                    label="Instagram"
                    value={project.instagram}
                    isLink
                  />
                )}
                {project.linkedin && (
                  <InfoRow
                    icon="in"
                    label="LinkedIn"
                    value={project.linkedin}
                    isLink
                  />
                )}
                {project.twitter && (
                  <InfoRow
                    icon="𝕏"
                    label="X / Twitter"
                    value={project.twitter}
                    isLink
                  />
                )}
                {project.youtube && (
                  <InfoRow
                    icon="▶"
                    label="YouTube"
                    value={project.youtube}
                    isLink
                  />
                )}
                {project.tiktok && (
                  <InfoRow
                    icon="♪"
                    label="TikTok"
                    value={project.tiktok}
                    isLink
                  />
                )}
                {project.gbp && (
                  <InfoRow icon="G" label="GBP" value={project.gbp} isLink />
                )}
              </>
            )}
          </div>
          {!hasAnyInfo && (
            <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
              No details added yet. Click "Edit Details" to add client info.
            </p>
          )}
        </div>
        {project.notes && (
          <div style={{ padding: "0 22px 18px" }}>
            <div
              onClick={() => setNotesOpen((o) => !o)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "#94a3b8",
                marginBottom: notesOpen ? 6 : 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                userSelect: "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  transition: "transform 0.2s",
                  transform: notesOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Description
            </div>
            {notesOpen && (
              <>
                <div
                  className="notes-display"
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                  dangerouslySetInnerHTML={{ __html: project.notes }}
                />
                <style>{`
                  .notes-display h2 { font-size: 18px; font-weight: 700; margin: 8px 0 4px; color: #1e293b; }
                  .notes-display h3 { font-size: 15px; font-weight: 700; margin: 8px 0 4px; color: #1e293b; }
                  .notes-display h4 { font-size: 13px; font-weight: 700; margin: 6px 0 2px; color: #475569; }
                  .notes-display ul, .notes-display ol { margin: 4px 0; padding-left: 22px; }
                  .notes-display li { margin: 2px 0; }
                  .notes-display a { color: #6366f1; text-decoration: underline; }
                  .notes-display p { margin: 4px 0; }
                `}</style>
              </>
            )}
          </div>
        )}
        {/* ─── Project Notes ─── */}
        {onAddNote && (
          <div style={{ padding: "0 22px 18px" }}>
            <div
              onClick={() => setProjNotesOpen((o) => !o)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "#94a3b8",
                marginBottom: projNotesOpen ? 10 : 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                userSelect: "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  transition: "transform 0.2s",
                  transform: projNotesOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Project Notes
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#94a3b8",
                  background: "#f1f5f9",
                  padding: "1px 7px",
                  borderRadius: 10,
                }}
              >
                {projNotes.length}
              </span>
            </div>
            {projNotesOpen && (
              <div>
                {/* Add note input */}
                <div style={{ display: "flex", gap: 10, marginBottom: projNotes.length > 0 ? 14 : 0 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#eef2ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#6366f1",
                      flexShrink: 0,
                    }}
                  >
                    {currentUser?.photoURL || authUser?.photoURL ? (
                      <img
                        src={currentUser?.photoURL || authUser?.photoURL}
                        style={{ width: 30, height: 30 }}
                        referrerPolicy="no-referrer"
                        alt=""
                      />
                    ) : (
                      (currentUser?.name || "?")[0]
                    )}
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 8 }}>
                    <textarea
                      ref={noteRef}
                      onChange={(e) => setNoteBtn(!!e.target.value.trim())}
                      placeholder="Add a note…"
                      rows={2}
                      style={{
                        flex: 1,
                        padding: "7px 11px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 13,
                        fontFamily: "inherit",
                        resize: "vertical",
                        outline: "none",
                        minHeight: 38,
                        color: "#1e293b",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#a5b4fc")}
                      onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && noteRef.current?.value.trim()) {
                          e.preventDefault();
                          onAddNote(project.id, noteRef.current.value);
                          noteRef.current.value = "";
                          setNoteBtn(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (noteRef.current?.value.trim()) {
                          onAddNote(project.id, noteRef.current.value);
                          noteRef.current.value = "";
                          setNoteBtn(false);
                        }
                      }}
                      disabled={!noteBtn}
                      style={{
                        padding: "7px 13px",
                        background: noteBtn
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "#f1f5f9",
                        color: noteBtn ? "#fff" : "#94a3b8",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: noteBtn ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                        alignSelf: "flex-end",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
                {/* Notes list */}
                {projNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#eef2ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#6366f1",
                        flexShrink: 0,
                      }}
                    >
                      {note.userPhoto ? (
                        <img
                          src={note.userPhoto}
                          style={{ width: 30, height: 30 }}
                          referrerPolicy="no-referrer"
                          alt=""
                        />
                      ) : (
                        (note.userName || "?")[0]
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#1e293b",
                          }}
                        >
                          {note.userName}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                          }}
                        >
                          {(() => {
                            const d = new Date(note.createdAt);
                            return d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }) + " at " + d.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            });
                          })()}
                        </span>
                        {(note.userId === currentUser?.id || canDelete) && (
                          <button
                            onClick={() => onDeleteNote(project.id, note.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#cbd5e1",
                              fontSize: 14,
                              padding: "0 4px",
                              marginLeft: "auto",
                            }}
                            onMouseEnter={(e) => (e.target.style.color = "#ef4444")}
                            onMouseLeave={(e) => (e.target.style.color = "#cbd5e1")}
                            title="Delete note"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#475569",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: note.text
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(
                              /(https?:\/\/[^\s<]+)/g,
                              '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:underline">$1</a>'
                            ),
                        }}
                      />
                    </div>
                  </div>
                ))}
                {projNotes.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 0 0",
                      color: "#94a3b8",
                      fontSize: 13,
                    }}
                  >
                    No notes yet. Add one above.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ───
function LoginScreen({ branding = {} }) {
  const appName = branding.appName || "Asolace PM";
  const logoText = branding.logoText || "A";
  const logoImageUrl = branding.logoImageUrl || "";
  const tagline = branding.tagline || "Project Management Portal";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          width: 420,
          background: "#fff",
          borderRadius: 20,
          padding: "48px 40px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 16,
            }}
          >
            {logoImageUrl ? (
              <img
                src={logoImageUrl}
                alt="Logo"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  objectFit: "cover",
                }}
              />
            ) : (
              logoText
            )}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: "#1a1a2e",
              letterSpacing: -0.5,
            }}
          >
            {appName}
          </h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>
            {tagline}
          </p>
        </div>

        {error && (
          <p
            style={{
              margin: "0 0 16px",
              color: "#ef4444",
              fontSize: 13,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: loading
              ? "#94a3b8"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 10,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: loading ? "none" : "0 4px 14px rgba(99,102,241,0.35)",
            transition: "all 0.15s",
          }}
          onMouseDown={(e) => {
            if (!loading) e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#34A853"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#FBBC05"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        <p
          style={{
            margin: "20px 0 0",
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          Restricted to @{ALLOWED_DOMAIN} accounts
        </p>
      </div>
    </div>
  );
}

// ─── Main App ───
export default function ProjectManager() {
  // Auth state
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in
  useEffect(() => onAuth((u) => setAuthUser(u || null)), []);

  // Real-time Firestore subscriptions
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [templateGroups, setTemplateGroups] = useState([]);
  const [branding, setBranding] = useState({
    appName: "Asolace PM",
    logoText: "A",
    logoImageUrl: "",
    tagline: "Project Management Portal",
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded >= 6) setDataLoaded(true);
    };
    const unsub1 = subscribeProjects((p) => {
      setProjects(p);
      checkLoaded();
    });
    const unsub2 = subscribeEmployees((e) => {
      setEmployees(e);
      checkLoaded();
    });
    const unsub3 = subscribeUsers((u) => {
      setAllUsers(u);
      checkLoaded();
    });
    const unsub4 = subscribeTeams((t) => {
      setTeams(t);
      checkLoaded();
    });
    const unsub5 = subscribeTaskTemplates((g) => {
      setTemplateGroups(g);
      checkLoaded();
    });
    const unsub6 = subscribeBranding((b) => {
      setBranding((prev) => ({ ...prev, ...b }));
      checkLoaded();
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
    };
  }, [authUser]);

  // Local UI state (not persisted)
  const [currentView, setCurrentView] = useState("master");

  // Update document title when branding changes
  useEffect(() => {
    document.title = branding.appName || "Asolace PM";
  }, [branding.appName]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [taskLayout, setTaskLayout] = useState("table");
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [detailTask, setDetailTask] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectFilterPriority, setProjectFilterPriority] = useState("");
  const [projectFilterStatus, setProjectFilterStatus] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailDescOpen, setDetailDescOpen] = useState(false);
  const [detailProjNotesOpen, setDetailProjNotesOpen] = useState(true);

  const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3, trivial: 4 };

  const sortedProjects = [...projects].sort(
    (a, b) =>
      (PRIORITY_RANK[a.projectPriority] ?? 2) -
      (PRIORITY_RANK[b.projectPriority] ?? 2),
  );

  const filteredProjects = sortedProjects.filter((p) => {
    if (
      projectSearch.trim() &&
      !(p.name || "").toLowerCase().includes(projectSearch.trim().toLowerCase())
    )
      return false;
    if (
      projectFilterPriority &&
      (p.projectPriority || "medium") !== projectFilterPriority
    )
      return false;
    if (
      projectFilterStatus &&
      (p.projectStatus || "not_started") !== projectFilterStatus
    )
      return false;
    return true;
  });

  // Loading state
  if (authUser === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        }}
      >
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <div style={{ textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      </div>
    );
  }

  // Auth gate
  if (!authUser) return <LoginScreen branding={branding} />;

  if (!dataLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        }}
      >
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <div style={{ textAlign: "center", color: "#94a3b8" }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  // Current user from Firestore (role may have been updated)
  const currentUser = allUsers.find((u) => u.id === authUser.uid) || {
    id: authUser.uid,
    email: authUser.email,
    name: authUser.displayName || authUser.email,
    role: "employee",
    photoURL: authUser.photoURL,
  };
  const role = currentUser.role || "employee";
  const can = (action) => PERMISSIONS[role]?.[action] || false;

  // Helper to set view state
  const set = (partial) => {
    if (partial.currentView !== undefined) setCurrentView(partial.currentView);
    if (partial.selectedProject !== undefined)
      setSelectedProject(partial.selectedProject);
    if (partial.activeEmployee !== undefined)
      setActiveEmployee(partial.activeEmployee);
  };

  // Link user to employee record by email
  const myEmployee = employees.find(
    (e) => (e.email || "").toLowerCase() === currentUser.email.toLowerCase(),
  );

  const LEGACY_STATUS_MAP = { todo: "not_started", review: "client_review" };
  const allTasks = projects.flatMap((p) =>
    (p.tasks || []).map((t) => ({
      ...t,
      projectId: p.id,
      status: LEGACY_STATUS_MAP[t.status] || t.status || "not_started",
    })),
  );
  const activeProj = projects.find((p) => p.id === selectedProject);

  // Employee view: only see own tasks
  const isEmployeeRole = role === "employee";
  const myTaskFilter = (t) => t.assignee === currentUser.id;
  const visibleTasks = isEmployeeRole
    ? allTasks.filter(myTaskFilter)
    : allTasks;
  const empTasks = activeEmployee
    ? allTasks.filter((t) => t.assignee === activeEmployee)
    : [];

  // ─── Project field mapping ───
  const PROJECT_FIELDS = [
    "projectName",
    "projectPriority",
    "projectStatus",
    "projectAssignee",
    "industry",
    "websiteLaunchDate",
    "seoStartDate",
    "projectClosedDate",
    "pointOfContact",
    "pocEmail",
    "pocPhone",
    "bizEmail",
    "bizPhone",
    "address",
    "website",
    "googleDoc",
    "facebook",
    "instagram",
    "linkedin",
    "twitter",
    "youtube",
    "tiktok",
    "gbp",
    "notes",
  ];

  function projectToForm(p) {
    const f = { editId: p.id };
    PROJECT_FIELDS.forEach((k) => {
      f[k] = p[k] || (k === "projectName" ? p.name : "");
    });
    // migrate old fields
    if (!f.bizEmail && p.email) f.bizEmail = p.email;
    if (!f.bizPhone && p.phone) f.bizPhone = p.phone;
    f.additionalContacts = p.additionalContacts || [];
    return f;
  }

  function formToProject(f) {
    const p = {};
    PROJECT_FIELDS.forEach((k) => {
      if (f[k]) p[k] = f[k];
    });
    p.name = f.projectName?.trim() || "Untitled";
    const contacts = (f.additionalContacts || []).filter(
      (c) => c.name?.trim() || c.email?.trim() || c.phone?.trim(),
    );
    if (contacts.length) p.additionalContacts = contacts;
    return p;
  }

  // ─── CRUD (Firebase) ───
  const addProject = async () => {
    if (!form.projectName?.trim()) return;
    const p = formToProject(form);
    const id = await addProjectDoc(p);
    set({ selectedProject: id, currentView: "project" });
    setForm({});
    setModal(null);
  };

  const editProject = async () => {
    if (!form.projectName?.trim()) return;
    const updates = formToProject(form);
    await updateProjectDoc(form.editId, updates);
    setForm({});
    setModal(null);
  };

  const autoSaveForm = (newForm) => {
    setForm(newForm);
    if (newForm.editId && newForm.projectName?.trim()) {
      const updates = formToProject(newForm);
      updateProjectDoc(newForm.editId, updates).catch(() => {});
    }
  };

  const deleteProject = async (id) => {
    await deleteProjectDoc(id);
    if (selectedProject === id) {
      set({ selectedProject: null, currentView: "master" });
    }
    setModal(null);
  };

  const addTask = async () => {
    if (!form.taskTitle?.trim() || !form.taskProject) return;
    const proj = projects.find((p) => p.id === form.taskProject);
    // Warn if assigning to someone not currently on this project
    if (form.taskAssignee && proj) {
      const projTasks = proj.tasks || [];
      if (!projTasks.some((t) => t.assignee === form.taskAssignee)) {
        const assigneeUser = allUsers.find((u) => u.id === form.taskAssignee);
        const name = assigneeUser ? assigneeUser.name : form.taskAssignee;
        if (
          !window.confirm(
            `"${name}" is not currently assigned to any tasks in "${proj.name}".\n\nAssign them to this task?`
          )
        )
          return;
      }
    }
    const t = {
      id: uid(),
      title: form.taskTitle.trim(),
      description: form.taskDesc || "",
      priority: form.taskPriority || "medium",
      effort: form.taskEffort || "moderate",
      status: "not_started",
      assignee: form.taskAssignee || (isEmployeeRole ? currentUser.id : null),
      dueDate: form.taskDueDate || null,
      taskType: form.taskType || null,
      createdAt: Date.now(),
      activities: [
        {
          id: uid(),
          message: "created this task",
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: Date.now(),
        },
      ],
    };
    if (proj) {
      await updateProjectDoc(proj.id, { tasks: [...(proj.tasks || []), t] });
    }
    setForm({});
    setModal(null);
  };

  const addTasksFromGroup = async (groupId, projectId) => {
    const grp = templateGroups.find((g) => g.id === groupId);
    if (!grp || !grp.templates.length) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const newTasks = grp.templates.map((tmpl) => ({
      id: uid(),
      title: tmpl.title,
      description: tmpl.description || "",
      priority: tmpl.priority || "medium",
      effort: tmpl.effort || "moderate",
      status: "not_started",
      assignee: null,
      dueDate: null,
      taskType: tmpl.taskType || null,
      subtasks: (tmpl.subtasks || []).map((s) => ({
        ...s,
        id: uid(),
        done: false,
      })),
      createdAt: Date.now(),
    }));
    await updateProjectDoc(proj.id, {
      tasks: [...(proj.tasks || []), ...newTasks],
    });
    setForm({});
    setModal(null);
  };

  const updateTask = async (taskId, updates) => {
    for (const proj of projects) {
      const tasks = proj.tasks || [];
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        // Warn if assigning to someone not currently on this project
        if (
          updates.assignee &&
          updates.assignee !== tasks[idx].assignee &&
          !tasks.some((t) => t.assignee === updates.assignee && t.id !== taskId)
        ) {
          const assigneeUser = allUsers.find((u) => u.id === updates.assignee);
          const name = assigneeUser ? assigneeUser.name : updates.assignee;
          if (
            !window.confirm(
              `"${name}" is not currently assigned to any tasks in "${proj.name}".\n\nAssign them to this task?`
            )
          )
            return;
        }
        const oldTask = tasks[idx];
        const activityEntries = [];
        const fieldLabels = {
          status: { label: "status", fmt: (v) => STATUS_LABELS[v] || v },
          priority: { label: "priority", fmt: (v) => v },
          effort: { label: "effort", fmt: (v) => EFFORT_LABELS[v] || v },
          assignee: {
            label: "assignee",
            fmt: (v) => {
              if (!v) return "Unassigned";
              const u = allUsers.find((x) => x.id === v);
              return u ? u.name : v;
            },
          },
          dueDate: { label: "due date", fmt: (v) => (v ? fmtDate(v) : "none") },
          title: { label: "title", fmt: (v) => v },
        };
        for (const [key, val] of Object.entries(updates)) {
          if (
            key === "description" ||
            key === "comments" ||
            key === "activities"
          )
            continue;
          const fl = fieldLabels[key];
          if (fl && oldTask[key] !== val) {
            activityEntries.push({
              id:
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 8),
              message: `changed ${fl.label} from "${fl.fmt(oldTask[key] || "")}" to "${fl.fmt(val)}"`,
              userId: currentUser.id,
              userName: currentUser.name,
              createdAt: Date.now(),
            });
          }
        }
        const existingActivities = oldTask.activities || [];
        const mergedUpdates = {
          ...updates,
          ...(activityEntries.length > 0
            ? { activities: [...existingActivities, ...activityEntries] }
            : {}),
        };
        const newTasks = tasks.map((t) =>
          t.id === taskId ? { ...t, ...mergedUpdates } : t,
        );
        await updateProjectDoc(proj.id, { tasks: newTasks });
        return;
      }
    }
  };

  const bulkUpdateTasks = async (updates) => {
    if (selectedTasks.size === 0) return;
    const projUpdates = new Map();
    for (const proj of projects) {
      const tasks = proj.tasks || [];
      const hasSelected = tasks.some((t) => selectedTasks.has(t.id));
      if (hasSelected) {
        projUpdates.set(
          proj.id,
          tasks.map((t) =>
            selectedTasks.has(t.id) ? { ...t, ...updates } : t,
          ),
        );
      }
    }
    await Promise.all(
      [...projUpdates.entries()].map(([projId, newTasks]) =>
        updateProjectDoc(projId, { tasks: newTasks }),
      ),
    );
    setSelectedTasks(new Set());
  };

  const deleteTask = async (taskId) => {
    for (const proj of projects) {
      const tasks = proj.tasks || [];
      if (tasks.some((t) => t.id === taskId)) {
        await updateProjectDoc(proj.id, {
          tasks: tasks.filter((t) => t.id !== taskId),
        });
        return;
      }
    }
  };

  const addEmployee = async () => {
    if (!form.empName?.trim()) return;
    await addEmployeeDoc({
      name: form.empName.trim(),
      role: form.empRole || "Team Member",
      email: form.empEmail?.trim() || "",
    });
    setForm({});
    setModal(null);
  };

  const removeEmployee = async (id) => {
    await deleteEmployeeDoc(id);
    // Unassign from tasks
    for (const proj of projects) {
      const tasks = proj.tasks || [];
      const needsUpdate =
        tasks.some((t) => t.assignee === id) || proj.projectAssignee === id;
      if (needsUpdate) {
        await updateProjectDoc(proj.id, {
          tasks: tasks.map((t) =>
            t.assignee === id ? { ...t, assignee: null } : t,
          ),
          ...(proj.projectAssignee === id ? { projectAssignee: null } : {}),
        });
      }
    }
    if (activeEmployee === id) set({ activeEmployee: null });
  };

  // ─── Project Notes CRUD ───
  const addProjectNote = async (projectId, text) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj || !text.trim()) return;
    const note = {
      id: uid(),
      text: text.trim(),
      userId: currentUser.id,
      userName: currentUser.name,
      userPhoto: currentUser.photoURL || authUser?.photoURL || "",
      createdAt: Date.now(),
    };
    await updateProjectDoc(projectId, {
      projectNotes: [...(proj.projectNotes || []), note],
    });
  };

  const deleteProjectNote = async (projectId, noteId) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    await updateProjectDoc(projectId, {
      projectNotes: (proj.projectNotes || []).filter((n) => n.id !== noteId),
    });
  };

  // ─── View Toggle ───
  const ViewToggle = () => (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        background: "#f1f5f9",
      }}
    >
      {[
        ["card", "▦ Cards"],
        ["table", "☰ Table"],
        ["calendar", "📅 Calendar"],
      ].map(([k, l]) => (
        <button
          key={k}
          onClick={() => setTaskLayout(k)}
          style={{
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: taskLayout === k ? "#fff" : "transparent",
            color: taskLayout === k ? "#1e293b" : "#94a3b8",
            boxShadow: taskLayout === k ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );

  // ─── Task Calendar ───
  const TaskCalendar = ({ tasks, showProject = false }) => {
    const [calMonth, setCalMonth] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const weeks = [];
    let day = 1 - firstDow;
    while (day <= daysInMonth) {
      const week = [];
      for (let i = 0; i < 7; i++, day++) {
        week.push(day >= 1 && day <= daysInMonth ? day : null);
      }
      weeks.push(week);
    }
    const today = new Date();
    const isToday = (d) => d && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const tasksByDay = {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const dd = new Date(t.dueDate + "T00:00:00");
      if (dd.getFullYear() === year && dd.getMonth() === month) {
        const d = dd.getDate();
        (tasksByDay[d] = tasksByDay[d] || []).push(t);
      }
    });
    const unscheduled = tasks.filter((t) => !t.dueDate);
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return (
      <div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e9ecef",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          {/* Calendar header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafbfe",
            }}
          >
            <button
              onClick={() => setCalMonth(new Date(year, month - 1, 1))}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit", fontWeight: 600 }}
            >
              ← Prev
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>
              {monthNames[month]} {year}
            </div>
            <button
              onClick={() => setCalMonth(new Date(year, month + 1, 1))}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "inherit", fontWeight: 600 }}
            >
              Next →
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f1f5f9" }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} style={{ padding: "8px 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 90, borderBottom: wi < weeks.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              {week.map((d, di) => {
                const dayTasks = d ? tasksByDay[d] || [] : [];
                return (
                  <div
                    key={di}
                    style={{
                      padding: "4px 6px",
                      borderRight: di < 6 ? "1px solid #f8fafc" : "none",
                      background: d ? (isToday(d) ? "#eef2ff" : "#fff") : "#fafbfe",
                      minHeight: 90,
                    }}
                  >
                    {d && (
                      <>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isToday(d) ? 800 : 500,
                            color: isToday(d) ? "#6366f1" : "#64748b",
                            marginBottom: 4,
                            textAlign: "right",
                            padding: "2px 4px",
                          }}
                        >
                          {d}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {dayTasks.slice(0, 3).map((t) => {
                            const pri = PRIORITY_COLORS[t.priority || "medium"];
                            const proj = showProject ? projects.find((p) => p.id === t.projectId) : null;
                            return (
                              <div
                                key={t.id}
                                onClick={() => setDetailTask(t.id)}
                                title={t.title + (proj ? " — " + proj.name : "")}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  background: pri.bg,
                                  borderLeft: `3px solid ${pri.dot}`,
                                  borderRadius: 4,
                                  padding: "3px 6px",
                                  cursor: "pointer",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  transition: "opacity 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                              >
                                {t.title}
                              </div>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, padding: "1px 6px" }}>
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* Unscheduled tasks */}
        {unscheduled.length > 0 && (
          <div
            style={{
              marginTop: 16,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e9ecef",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 10 }}>
              No Due Date ({unscheduled.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {unscheduled.map((t) => {
                const pri = PRIORITY_COLORS[t.priority || "medium"];
                const proj = showProject ? projects.find((p) => p.id === t.projectId) : null;
                return (
                  <div
                    key={t.id}
                    onClick={() => setDetailTask(t.id)}
                    title={t.title + (proj ? " — " + proj.name : "")}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#1e293b",
                      background: pri.bg,
                      borderLeft: `3px solid ${pri.dot}`,
                      borderRadius: 6,
                      padding: "5px 10px",
                      cursor: "pointer",
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {t.title}{proj ? ` · ${proj.name}` : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Task Table ───
  const TaskTable = ({
    tasks,
    showProject = false,
    isEmployee: isEmp = false,
  }) => {
    const [dueDateSort, setDueDateSort] = useState("asc"); // null | 'asc' | 'desc'
    const sortedTasks = useMemo(() => {
      if (!dueDateSort) return tasks;
      return [...tasks].sort((a, b) => {
        const da = a.dueDate || "";
        const db = b.dueDate || "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return dueDateSort === "asc"
          ? da.localeCompare(db)
          : db.localeCompare(da);
      });
    }, [tasks, dueDateSort]);
    const allChecked =
      tasks.length > 0 && tasks.every((t) => selectedTasks.has(t.id));
    const someChecked = tasks.some((t) => selectedTasks.has(t.id));
    const toggleAll = () => {
      if (allChecked) {
        const next = new Set(selectedTasks);
        tasks.forEach((t) => next.delete(t.id));
        setSelectedTasks(next);
      } else {
        const next = new Set(selectedTasks);
        tasks.forEach((t) => next.add(t.id));
        setSelectedTasks(next);
      }
    };
    const toggleOne = (id) => {
      const next = new Set(selectedTasks);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedTasks(next);
    };
    const th = {
      padding: "10px 14px",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: "#64748b",
      textAlign: "left",
      borderBottom: "2px solid #e9ecef",
      background: "#f8fafc",
      whiteSpace: "nowrap",
    };
    const td = {
      padding: "12px 14px",
      fontSize: 13,
      color: "#1e293b",
      borderBottom: "1px solid #f1f5f9",
      verticalAlign: "middle",
    };
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e9ecef",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* ─── Bulk Action Toolbar ─── */}
        {someChecked && !isEmp && (
          <div
            style={{
              padding: "10px 16px",
              background: "#eef2ff",
              borderBottom: "1px solid #e0e7ff",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#4f46e5",
                marginRight: 4,
              }}
            >
              {
                [...selectedTasks].filter((id) =>
                  tasks.some((t) => t.id === id),
                ).length
              }{" "}
              selected
            </span>
            {/* Status bulk dropdown with color dots */}
            {(() => {
              const opts = Object.entries(STATUS_LABELS).map(([k, v]) => ({ key: k, label: v, dotStyle: STATUS_DOT_STYLE[k] }));
              return (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const el = e.currentTarget.nextSibling; el.style.display = el.style.display === "block" ? "none" : "block"; }}
                    style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, background: "#fff", fontFamily: "inherit", cursor: "pointer", color: "#4f46e5", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    Set Status… <span style={{ fontSize: 8, color: "#a5b4fc" }}>▼</span>
                  </button>
                  <div style={{ display: "none", position: "absolute", top: "100%", left: 0, zIndex: 60, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, marginTop: 2, paddingBlock: 4, minWidth: 160, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {opts.map(o => (
                      <div key={o.key} onClick={(e) => { bulkUpdateTasks({ status: o.key }); e.currentTarget.parentElement.style.display = "none"; }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "#334155" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={o.dotStyle} /> {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* Priority bulk dropdown with color dots */}
            {(() => {
              const priOrder = ["critical","high","medium","low","trivial"];
              const opts = priOrder.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), color: PRIORITY_COLORS[k].dot }));
              return (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const el = e.currentTarget.nextSibling; el.style.display = el.style.display === "block" ? "none" : "block"; }}
                    style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, background: "#fff", fontFamily: "inherit", cursor: "pointer", color: "#4f46e5", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    Set Priority… <span style={{ fontSize: 8, color: "#a5b4fc" }}>▼</span>
                  </button>
                  <div style={{ display: "none", position: "absolute", top: "100%", left: 0, zIndex: 60, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, marginTop: 2, paddingBlock: 4, minWidth: 140, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {opts.map(o => (
                      <div key={o.key} onClick={(e) => { bulkUpdateTasks({ priority: o.key }); e.currentTarget.parentElement.style.display = "none"; }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "#334155" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* Effort bulk dropdown with color dots */}
            {(() => {
              const opts = Object.entries(EFFORT_LABELS).map(([k, v]) => ({ key: k, label: v, color: EFFORT_COLORS[k].dot }));
              return (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const el = e.currentTarget.nextSibling; el.style.display = el.style.display === "block" ? "none" : "block"; }}
                    style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, background: "#fff", fontFamily: "inherit", cursor: "pointer", color: "#4f46e5", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    Set Effort… <span style={{ fontSize: 8, color: "#a5b4fc" }}>▼</span>
                  </button>
                  <div style={{ display: "none", position: "absolute", top: "100%", left: 0, zIndex: 60, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, marginTop: 2, paddingBlock: 4, minWidth: 140, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {opts.map(o => (
                      <div key={o.key} onClick={(e) => { bulkUpdateTasks({ effort: o.key }); e.currentTarget.parentElement.style.display = "none"; }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "#334155" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* Assignee bulk dropdown */}
            {(() => {
              const opts = [{ key: "__unassign__", label: "Unassigned" }, ...allUsers.map(u => ({ key: u.id, label: u.name }))];
              return (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const el = e.currentTarget.nextSibling; el.style.display = el.style.display === "block" ? "none" : "block"; }}
                    style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, background: "#fff", fontFamily: "inherit", cursor: "pointer", color: "#4f46e5", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    Set Assignee… <span style={{ fontSize: 8, color: "#a5b4fc" }}>▼</span>
                  </button>
                  <div style={{ display: "none", position: "absolute", top: "100%", left: 0, zIndex: 60, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, marginTop: 2, paddingBlock: 4, minWidth: 160, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {opts.map(o => (
                      <div key={o.key} onClick={(e) => { bulkUpdateTasks({ assignee: o.key === "__unassign__" ? null : o.key }); e.currentTarget.parentElement.style.display = "none"; }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: o.key === "__unassign__" ? "#94a3b8" : "#334155" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.key === "__unassign__" ? "#cbd5e1" : "#6366f1", flexShrink: 0 }} /> {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* Task Type bulk dropdown with color dots */}
            {(() => {
              const opts = [{ key: "__clear__", label: "None", color: "#cbd5e1" }, ...Object.entries(TASK_TYPES).map(([k, v]) => ({ key: k, label: v.label, color: v.color }))];
              return (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const el = e.currentTarget.nextSibling; el.style.display = el.style.display === "block" ? "none" : "block"; }}
                    style={{ padding: "5px 8px", border: "1px solid #c7d2fe", borderRadius: 6, background: "#fff", fontFamily: "inherit", cursor: "pointer", color: "#4f46e5", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    Set Type… <span style={{ fontSize: 8, color: "#a5b4fc" }}>▼</span>
                  </button>
                  <div style={{ display: "none", position: "absolute", top: "100%", left: 0, zIndex: 60, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, marginTop: 2, paddingBlock: 4, minWidth: 140, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                    {opts.map(o => (
                      <div key={o.key} onClick={(e) => { bulkUpdateTasks({ taskType: o.key === "__clear__" ? "" : o.key }); e.currentTarget.parentElement.style.display = "none"; }}
                        style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "#334155" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> {o.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <input
              type="date"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  bulkUpdateTasks({ dueDate: e.target.value });
              }}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                border: "1px solid #c7d2fe",
                borderRadius: 6,
                background: "#fff",
                fontFamily: "inherit",
                cursor: "pointer",
                color: "#4f46e5",
                fontWeight: 600,
              }}
              title="Set due date for selected tasks"
            />
            <button
              onClick={() => {
                const taskIds = [...selectedTasks].filter((id) =>
                  tasks.some((t) => t.id === id),
                );
                const next = new Set(selectedTasks);
                taskIds.forEach((id) => next.delete(id));
                setSelectedTasks(next);
              }}
              style={{
                marginLeft: "auto",
                fontSize: 12,
                padding: "5px 10px",
                background: "transparent",
                border: "1px solid #c7d2fe",
                borderRadius: 6,
                color: "#64748b",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Clear Selection
            </button>
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
          >
            <thead>
              <tr>
                {!isEmp && (
                  <th style={{ ...th, width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={toggleAll}
                      style={{ cursor: "pointer", accentColor: "#6366f1" }}
                    />
                  </th>
                )}
                <th style={{ ...th, minWidth: 300 }}>Task</th>
                {showProject && <th style={th}>Project</th>}
                <th style={th}>Status</th>
                <th style={th}>Priority</th>
                <th style={th}>Effort</th>
                <th
                  style={{ ...th, cursor: "pointer", userSelect: "none" }}
                  onClick={() =>
                    setDueDateSort((s) =>
                      s === null ? "asc" : s === "asc" ? "desc" : null,
                    )
                  }
                  title="Sort by due date"
                >
                  Due Date{" "}
                  {dueDateSort === "asc"
                    ? " ▲"
                    : dueDateSort === "desc"
                      ? " ▼"
                      : ""}
                </th>
                <th style={th}>Type</th>
                <th style={th}>Assignee</th>
                <th style={th}>Created</th>
                {!isEmp && (
                  <th style={{ ...th, width: 50, textAlign: "center" }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={showProject ? 12 : 11}
                    style={{
                      ...td,
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: 40,
                    }}
                  >
                    No tasks
                  </td>
                </tr>
              )}
              {sortedTasks.map((t) => {
                const proj = projects.find((p) => p.id === t.projectId);
                const assignee = allUsers.find((u) => u.id === t.assignee);
                const pri = PRIORITY_COLORS[t.priority || "medium"];
                return (
                  <tr
                    key={t.id}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#fafbfe")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = selectedTasks.has(
                        t.id,
                      )
                        ? "#f5f3ff"
                        : "transparent")
                    }
                    style={{
                      background: selectedTasks.has(t.id)
                        ? "#f5f3ff"
                        : "transparent",
                    }}
                  >
                    {!isEmp && (
                      <td style={{ ...td, textAlign: "center", width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(t.id)}
                          onChange={() => toggleOne(t.id)}
                          style={{ cursor: "pointer", accentColor: "#6366f1" }}
                        />
                      </td>
                    )}
                    <td style={td}>
                      <div
                        onClick={() => setDetailTask(t.id)}
                        style={{
                          fontWeight: 600,
                          padding: "4px 8px",
                          cursor: "pointer",
                          color: "#6366f1",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.textDecoration = "underline")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.textDecoration = "none")
                        }
                      >
                        {t.title}
                      </div>
                      {t.subtasks && t.subtasks.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "2px 8px",
                          }}
                        >
                          <div
                            style={{
                              width: 60,
                              height: 4,
                              background: "#f1f5f9",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100}%`,
                                background: "#22c55e",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {t.subtasks.filter((s) => s.done).length}/
                            {t.subtasks.length}
                          </span>
                        </div>
                      )}
                    </td>
                    {showProject && (
                      <td style={td}>
                        {proj && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#6366f1",
                              background: "#eef2ff",
                              padding: "3px 9px",
                              borderRadius: 20,
                            }}
                          >
                            {proj.name}
                          </span>
                        )}
                      </td>
                    )}
                    <td style={td}>
                      <StatusSelect
                        value={t.status}
                        onChange={(s) => updateTask(t.id, { status: s })}
                        size="md"
                      />
                    </td>
                    <td style={td}>
                      {!isEmp ? (
                        <PrioritySelect
                          value={t.priority}
                          onChange={(v) => updateTask(t.id, { priority: v })}
                        />
                      ) : (
                        <Badge
                          color={PRIORITY_COLORS[t.priority || "medium"].dot}
                          label={t.priority || "medium"}
                        />
                      )}
                    </td>
                    <td style={td}>
                      {!isEmp ? (
                        <EffortSelect
                          value={t.effort}
                          onChange={(v) => updateTask(t.id, { effort: v })}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {EFFORT_LABELS[t.effort] || t.effort || "—"}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {!isEmp ? (
                        <DateCell
                          value={t.dueDate}
                          onChange={(v) =>
                            updateTask(t.id, { dueDate: v || null })
                          }
                        />
                      ) : (
                        <DueDateLabel dueDate={t.dueDate} />
                      )}
                    </td>
                    <td style={td}>
                      {!isEmp ? (
                        <TaskTypeSelect
                          value={t.taskType || ""}
                          onChange={(v) =>
                            updateTask(t.id, { taskType: v || null })
                          }
                        />
                      ) : (
                        (() => {
                          const tt = TASK_TYPES[t.taskType];
                          return tt ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 9px",
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                background: tt.bg,
                                color: tt.color,
                                border: `1px solid ${tt.color}22`,
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: tt.color,
                                }}
                              />
                              {tt.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>
                              —
                            </span>
                          );
                        })()
                      )}
                    </td>
                    <td style={td}>
                      {!isEmp ? (
                        <select
                          value={t.assignee || ""}
                          onChange={(e) =>
                            updateTask(t.id, {
                              assignee: e.target.value || null,
                            })
                          }
                          style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            background: "#fff",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">Unassigned</option>
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                          {assignee?.name || "Unassigned"}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDate(t.createdAt)}
                      </span>
                    </td>
                    {!isEmp && (
                      <td style={{ ...td, textAlign: "center" }}>
                        <button
                          onClick={() => deleteTask(t.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#cbd5e1",
                            fontSize: 16,
                            padding: 4,
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.color = "#cbd5e1")
                          }
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Sidebar ───
  function SideBtn({ active, onClick, icon, children, style: sx }) {
    return (
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: "100%",
          padding: "9px 12px",
          background: active ? "rgba(99,102,241,0.12)" : "transparent",
          color: active ? "#a5b4fc" : "#94a3b8",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          fontFamily: "inherit",
          textAlign: "left",
          transition: "all 0.15s",
          marginBottom: 2,
          ...sx,
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
        {children}
      </button>
    );
  }

  const renderSidebar = () => (
    <div
      style={{
        width: 260,
        minHeight: "100vh",
        background: "#1a1a2e",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "24px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: can("manageRoles") ? "pointer" : "default",
            borderRadius: 10,
            padding: 4,
            margin: -4,
            transition: "background 0.15s",
          }}
          onClick={() => can("manageRoles") && set({ currentView: "branding" })}
          onMouseEnter={(e) => {
            if (can("manageRoles"))
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          title={can("manageRoles") ? "Click to edit branding" : ""}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {branding.logoImageUrl ? (
              <img
                src={branding.logoImageUrl}
                alt="Logo"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  objectFit: "cover",
                }}
              />
            ) : (
              branding.logoText || "A"
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>
              {branding.appName || "Asolace PM"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Project Manager
            </div>
          </div>
          {can("manageRoles") && (
            <span style={{ fontSize: 12, color: "#64748b", opacity: 0.5 }}>
              ✎
            </span>
          )}
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: "14px 16px 6px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              overflow: "hidden",
              background: "#eef2ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#6366f1",
            }}
          >
            {currentUser.photoURL || authUser?.photoURL ? (
              <img
                src={currentUser.photoURL || authUser.photoURL}
                style={{ width: 28, height: 28 }}
                referrerPolicy="no-referrer"
                alt=""
              />
            ) : (
              currentUser.name[0]
            )}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#e2e8f0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser.name}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: ROLES[role].color,
                letterSpacing: 0.3,
              }}
            >
              {ROLES[role].label}
            </div>
          </div>
        </div>
      </div>

      {can("viewMaster") ? (
        <>
          <div style={{ padding: "12px 16px 4px" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                color: "#64748b",
                marginBottom: 8,
              }}
            >
              Views
            </div>
            <SideBtn
              active={currentView === "master"}
              onClick={() => set({ currentView: "master" })}
              icon="▦"
            >
              Master Board
            </SideBtn>
            <SideBtn
              active={currentView === "team"}
              onClick={() => set({ currentView: "team" })}
              icon="◉"
            >
              Team
            </SideBtn>
            {can("manageRoles") && (
              <SideBtn
                active={currentView === "users"}
                onClick={() => set({ currentView: "users" })}
                icon="⚙"
              >
                Users & Roles
              </SideBtn>
            )}
            {can("editProject") && (
              <SideBtn
                active={currentView === "templates"}
                onClick={() => set({ currentView: "templates" })}
                icon="☰"
              >
                Task Templates
              </SideBtn>
            )}
          </div>
          <div style={{ padding: "12px 16px 4px", flex: 1, overflowY: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: "#64748b",
                }}
              >
                Client Projects
              </div>
              {can("createProject") && (
                <button
                  onClick={() => {
                    setForm({
                      projectPriority: "medium",
                      projectStatus: "not_started",
                    });
                    setModal("addProject");
                  }}
                  style={{
                    background: "rgba(99,102,241,0.15)",
                    border: "none",
                    color: "#a5b4fc",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  +
                </button>
              )}
            </div>
            <div
              style={{
                padding: "0 0 8px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects…"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 7,
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                {/* Priority filter with color dots */}
                {(() => {
                  const priOrder = ["critical","high","medium","low","trivial"];
                  const priOpts = [{ key: "", label: "All Priorities", color: null }, ...priOrder.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), color: PRIORITY_COLORS[k].dot }))];
                  const selected = priOpts.find(o => o.key === projectFilterPriority) || priOpts[0];
                  return (
                    <div style={{ flex: 1, position: "relative" }}>
                      <button
                        onClick={(e) => {
                          const el = e.currentTarget.nextSibling;
                          el.style.display = el.style.display === "block" ? "none" : "block";
                        }}
                        style={{
                          width: "100%",
                          padding: "4px 6px",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          color: projectFilterPriority ? "#e2e8f0" : "#64748b",
                          fontSize: 11,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {selected.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />}
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.label}</span>
                        <span style={{ fontSize: 8, color: "#64748b" }}>▼</span>
                      </button>
                      <div style={{ display: "none", position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, marginTop: 2, paddingBlock: 2, maxHeight: 200, overflowY: "auto" }}>
                        {priOpts.map(o => (
                          <div
                            key={o.key}
                            onClick={(e) => {
                              setProjectFilterPriority(o.key);
                              e.currentTarget.parentElement.style.display = "none";
                            }}
                            style={{
                              padding: "5px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: o.key === projectFilterPriority ? "#e2e8f0" : "#94a3b8",
                              background: o.key === projectFilterPriority ? "rgba(99,102,241,0.15)" : "transparent",
                            }}
                            onMouseEnter={(e) => { if (o.key !== projectFilterPriority) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (o.key !== projectFilterPriority) e.currentTarget.style.background = "transparent"; }}
                          >
                            {o.color ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> : <span style={{ width: 7 }} />}
                            {o.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Status filter with color dots */}
                {(() => {
                  const stOpts = [{ key: "", label: "All Statuses", color: null }, ...Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => ({ key: k, label: v, color: PROJECT_STATUS_COLORS[k] }))];
                  const selected = stOpts.find(o => o.key === projectFilterStatus) || stOpts[0];
                  return (
                    <div style={{ flex: 1, position: "relative" }}>
                      <button
                        onClick={(e) => {
                          const el = e.currentTarget.nextSibling;
                          el.style.display = el.style.display === "block" ? "none" : "block";
                        }}
                        style={{
                          width: "100%",
                          padding: "4px 6px",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          color: projectFilterStatus ? "#e2e8f0" : "#64748b",
                          fontSize: 11,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {selected.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />}
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.label}</span>
                        <span style={{ fontSize: 8, color: "#64748b" }}>▼</span>
                      </button>
                      <div style={{ display: "none", position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, marginTop: 2, paddingBlock: 2, maxHeight: 200, overflowY: "auto" }}>
                        {stOpts.map(o => (
                          <div
                            key={o.key}
                            onClick={(e) => {
                              setProjectFilterStatus(o.key);
                              e.currentTarget.parentElement.style.display = "none";
                            }}
                            style={{
                              padding: "5px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: o.key === projectFilterStatus ? "#e2e8f0" : "#94a3b8",
                              background: o.key === projectFilterStatus ? "rgba(99,102,241,0.15)" : "transparent",
                            }}
                            onMouseEnter={(e) => { if (o.key !== projectFilterStatus) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (o.key !== projectFilterStatus) e.currentTarget.style.background = "transparent"; }}
                          >
                            {o.color ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> : <span style={{ width: 7 }} />}
                            {o.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            {filteredProjects.map((p) => {
              const stColor =
                PROJECT_STATUS_COLORS[p.projectStatus || "not_started"];
              const priColor = PRIORITY_COLORS[p.projectPriority || "medium"];
              return (
                <SideBtn
                  key={p.id}
                  active={currentView === "project" && selectedProject === p.id}
                  onClick={() =>
                    set({ currentView: "project", selectedProject: p.id })
                  }
                  icon={
                    <span
                      title={(p.projectPriority || "medium") + " priority"}
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: priColor.dot,
                      }}
                    />
                  }
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      flexShrink: 0,
                      ...((p.projectStatus || "not_started") === "not_started"
                        ? {
                            background: "transparent",
                            border: `1.5px solid ${stColor}`,
                            boxSizing: "border-box",
                          }
                        : {
                            background: stColor,
                            border: `1.5px solid ${stColor}`,
                          }),
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {(p.tasks || []).length}
                  </span>
                </SideBtn>
              );
            })}
            {(projectSearch.trim() ||
              projectFilterPriority ||
              projectFilterStatus) &&
              filteredProjects.length === 0 && (
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  No projects found
                </div>
              )}
          </div>
        </>
      ) : (
        /* Employee role sidebar */
        <div style={{ padding: "12px 16px 4px", flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            My Views
          </div>
          <SideBtn
            active={currentView === "myTasks"}
            onClick={() => set({ currentView: "myTasks" })}
            icon="✓"
          >
            My Tasks
          </SideBtn>
          {(() => {
            let myProjects = projects.filter((p) =>
              (p.tasks || []).some((t) => t.assignee === currentUser.id) ||
              p.projectAssignee === currentUser.id,
            );
            // Apply search filter
            if (projectSearch.trim()) {
              myProjects = myProjects.filter((p) =>
                (p.name || "").toLowerCase().includes(projectSearch.trim().toLowerCase())
              );
            }
            // Apply priority filter
            if (projectFilterPriority) {
              myProjects = myProjects.filter((p) => (p.projectPriority || "medium") === projectFilterPriority);
            }
            // Apply status filter
            if (projectFilterStatus) {
              myProjects = myProjects.filter((p) => (p.projectStatus || "not_started") === projectFilterStatus);
            }
            // Sort by priority
            myProjects.sort((a, b) =>
              (PRIORITY_RANK[a.projectPriority] ?? 2) -
              (PRIORITY_RANK[b.projectPriority] ?? 2)
            );
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    margin: "16px 0 8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                      color: "#64748b",
                    }}
                  >
                    My Projects
                  </div>
                </div>
                <div
                  style={{
                    padding: "0 0 8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects…"
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 7,
                      color: "#e2e8f0",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Priority filter with color dots */}
                    {(() => {
                      const priOrder = ["critical","high","medium","low","trivial"];
                      const priOpts = [{ key: "", label: "All Priorities", color: null }, ...priOrder.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), color: PRIORITY_COLORS[k].dot }))];
                      const selected = priOpts.find(o => o.key === projectFilterPriority) || priOpts[0];
                      return (
                        <div style={{ flex: 1, position: "relative" }}>
                          <button
                            onClick={(e) => {
                              const el = e.currentTarget.nextSibling;
                              el.style.display = el.style.display === "block" ? "none" : "block";
                            }}
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 6,
                              color: projectFilterPriority ? "#e2e8f0" : "#64748b",
                              fontSize: 11,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {selected.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />}
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.label}</span>
                            <span style={{ fontSize: 8, color: "#64748b" }}>▼</span>
                          </button>
                          <div style={{ display: "none", position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, marginTop: 2, paddingBlock: 2, maxHeight: 200, overflowY: "auto" }}>
                            {priOpts.map(o => (
                              <div
                                key={o.key}
                                onClick={(e) => {
                                  setProjectFilterPriority(o.key);
                                  e.currentTarget.parentElement.style.display = "none";
                                }}
                                style={{
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: o.key === projectFilterPriority ? "#e2e8f0" : "#94a3b8",
                                  background: o.key === projectFilterPriority ? "rgba(99,102,241,0.15)" : "transparent",
                                }}
                                onMouseEnter={(e) => { if (o.key !== projectFilterPriority) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                                onMouseLeave={(e) => { if (o.key !== projectFilterPriority) e.currentTarget.style.background = "transparent"; }}
                              >
                                {o.color ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> : <span style={{ width: 7 }} />}
                                {o.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Status filter with color dots */}
                    {(() => {
                      const stOpts = [{ key: "", label: "All Statuses", color: null }, ...Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => ({ key: k, label: v, color: PROJECT_STATUS_COLORS[k] }))];
                      const selected = stOpts.find(o => o.key === projectFilterStatus) || stOpts[0];
                      return (
                        <div style={{ flex: 1, position: "relative" }}>
                          <button
                            onClick={(e) => {
                              const el = e.currentTarget.nextSibling;
                              el.style.display = el.style.display === "block" ? "none" : "block";
                            }}
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 6,
                              color: projectFilterStatus ? "#e2e8f0" : "#64748b",
                              fontSize: 11,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {selected.color && <span style={{ width: 7, height: 7, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />}
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.label}</span>
                            <span style={{ fontSize: 8, color: "#64748b" }}>▼</span>
                          </button>
                          <div style={{ display: "none", position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, marginTop: 2, paddingBlock: 2, maxHeight: 200, overflowY: "auto" }}>
                            {stOpts.map(o => (
                              <div
                                key={o.key}
                                onClick={(e) => {
                                  setProjectFilterStatus(o.key);
                                  e.currentTarget.parentElement.style.display = "none";
                                }}
                                style={{
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  color: o.key === projectFilterStatus ? "#e2e8f0" : "#94a3b8",
                                  background: o.key === projectFilterStatus ? "rgba(99,102,241,0.15)" : "transparent",
                                }}
                                onMouseEnter={(e) => { if (o.key !== projectFilterStatus) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                                onMouseLeave={(e) => { if (o.key !== projectFilterStatus) e.currentTarget.style.background = "transparent"; }}
                              >
                                {o.color ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color, flexShrink: 0 }} /> : <span style={{ width: 7 }} />}
                                {o.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {myProjects.map((p) => {
                  const stColor =
                    PROJECT_STATUS_COLORS[p.projectStatus || "not_started"];
                  const priColor = PRIORITY_COLORS[p.projectPriority || "medium"];
                  const taskCount = p.projectAssignee === currentUser.id
                    ? (p.tasks || []).length
                    : (p.tasks || []).filter((t) => t.assignee === currentUser.id).length;
                  return (
                  <SideBtn
                    key={p.id}
                    active={
                      currentView === "project" && selectedProject === p.id
                    }
                    onClick={() =>
                      set({ currentView: "project", selectedProject: p.id })
                    }
                    icon={
                      <span
                        title={(p.projectPriority || "medium") + " priority"}
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: priColor.dot,
                        }}
                      />
                    }
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        flexShrink: 0,
                        ...((p.projectStatus || "not_started") === "not_started"
                          ? {
                              background: "transparent",
                              border: `1.5px solid ${stColor}`,
                              boxSizing: "border-box",
                            }
                          : {
                              background: stColor,
                              border: `1.5px solid ${stColor}`,
                            }),
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {taskCount}
                    </span>
                  </SideBtn>
                  );
                })}
                {(projectSearch.trim() ||
                  projectFilterPriority ||
                  projectFilterStatus) &&
                  myProjects.length === 0 && (
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      No projects found
                    </div>
                  )}
              </>
            );
          })()}
        </div>
      )}

      <div
        style={{
          padding: 16,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={logOut}
          style={{
            width: "100%",
            padding: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  // ─── Master View ───
  const MasterView = () => {
    const grouped = {};
    Object.keys(STATUS_LABELS).forEach((s) => {
      grouped[s] = [];
    });
    allTasks.forEach((t) => {
      (grouped[t.status || "not_started"] =
        grouped[t.status || "not_started"] || []).push(t);
    });

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#1a1a2e",
                letterSpacing: -0.5,
              }}
            >
              Master Board
            </h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>
              {allTasks.length} tasks across {projects.length} projects
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ViewToggle />
            {can("createTask") && (
              <Btn
                onClick={() => {
                  setForm({ taskProject: projects[0]?.id || "" });
                  setModal("addTask");
                }}
              >
                + Add Task
              </Btn>
            )}
          </div>
        </div>
        {taskLayout === "calendar" ? (
          <TaskCalendar tasks={allTasks} showProject />
        ) : taskLayout === "table" ? (
          <TaskTable tasks={allTasks} showProject />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            {Object.entries(STATUS_GROUPS).map(([groupName, statuses]) => {
              const groupTasks = statuses.flatMap((s) => grouped[s] || []);
              return (
                <div
                  key={groupName}
                  style={{
                    background: "#f1f5f9",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                      padding: "0 4px",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: STATUS_GROUP_COLORS[groupName],
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#1e293b",
                      }}
                    >
                      {groupName}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginLeft: "auto",
                      }}
                    >
                      {groupTasks.length}
                    </span>
                  </div>
                  {statuses.map((status) => {
                    const tasks = grouped[status] || [];
                    if (tasks.length === 0 && statuses.length > 1) return null;
                    return (
                      <div key={status} style={{ marginBottom: 12 }}>
                        {statuses.length > 1 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 8,
                              padding: "0 2px",
                            }}
                          >
                            <StatusDot status={status} size={6} />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              {STATUS_LABELS[status]}
                            </span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              {tasks.length}
                            </span>
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {tasks.map((t) => (
                            <TaskCard
                              key={t.id}
                              task={t}
                              project={projects.find(
                                (p) => p.id === t.projectId,
                              )}
                              users={allUsers}
                              onUpdate={updateTask}
                              onDelete={deleteTask}
                              onOpenDetail={(id) => setDetailTask(id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {groupTasks.length === 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        textAlign: "center",
                        padding: "20px 0",
                      }}
                    >
                      No tasks
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── Project View ───
  const ProjectView = () => {
    if (!activeProj)
      return (
        <div style={{ color: "#94a3b8", padding: 40 }}>
          Select a project from the sidebar.
        </div>
      );
    const allProjTasks = activeProj.tasks || [];
    const isProjectAssignee = activeProj.projectAssignee === currentUser.id;
    const tasks = isEmployeeRole && !isProjectAssignee
      ? allProjTasks.filter((t) => t.assignee === currentUser.id)
      : allProjTasks;
    const openEdit = () => {
      setForm(projectToForm(activeProj));
      setModal("editProject");
    };

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {activeProj.name[0]}
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#1a1a2e",
                  letterSpacing: -0.5,
                }}
              >
                {activeProj.name}
              </h1>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <Badge
                  color={
                    PRIORITY_COLORS[activeProj.projectPriority || "medium"].dot
                  }
                  label={(activeProj.projectPriority || "medium") + " priority"}
                />
                <Badge
                  color={
                    PROJECT_STATUS_COLORS[
                      activeProj.projectStatus || "not_started"
                    ]
                  }
                  label={
                    PROJECT_STATUS_LABELS[
                      activeProj.projectStatus || "not_started"
                    ]
                  }
                />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Added {fmtDate(activeProj.createdAt)}
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  {tasks.length} tasks
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {can("deleteProject") && (
              <Btn
                variant="danger"
                size="sm"
                onClick={() => setModal("confirmDeleteProject")}
              >
                Delete
              </Btn>
            )}
            {can("createTask") && (
              <Btn
                size="sm"
                onClick={() => {
                  setForm({ taskProject: activeProj.id });
                  setModal("addTask");
                }}
              >
                + Task
              </Btn>
            )}
          </div>
        </div>

        <ProjectDetailPanel
          project={activeProj}
          users={allUsers}
          onEdit={openEdit}
          canEdit={can("editProject")}
          currentUser={currentUser}
          authUser={authUser}
          onAddNote={addProjectNote}
          onDeleteNote={deleteProjectNote}
          canDelete={can("deleteProject")}
          open={detailPanelOpen}
          setOpen={setDetailPanelOpen}
          notesOpen={detailDescOpen}
          setNotesOpen={setDetailDescOpen}
          projNotesOpen={detailProjNotesOpen}
          setProjNotesOpen={setDetailProjNotesOpen}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Tasks
          </h2>
          <ViewToggle />
        </div>

        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              color: "#94a3b8",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e9ecef",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>No tasks yet</p>
            <p style={{ fontSize: 13 }}>Add a task to get started.</p>
          </div>
        ) : taskLayout === "calendar" ? (
          <TaskCalendar tasks={tasks.map((t) => ({ ...t, projectId: activeProj.id }))} />
        ) : taskLayout === "table" ? (
          <TaskTable
            tasks={tasks.map((t) => ({ ...t, projectId: activeProj.id }))}
            isEmployee={isEmployeeRole}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                users={allUsers}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onOpenDetail={(id) => setDetailTask(id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Team View ───
  const TeamView = () => {
    const createTeam = async () => {
      if (!form.teamName?.trim()) return;
      await addTeamDoc({ name: form.teamName.trim() });
      setForm({});
      setModal(null);
    };

    const addMemberToTeam = async (teamId) => {
      if (!form.selectedUserId) return;
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;
      const members = team.members || [];
      if (members.includes(form.selectedUserId)) return;
      await updateTeamDoc(teamId, {
        members: [...members, form.selectedUserId],
      });
      setForm({});
      setModal(null);
    };

    const removeMemberFromTeam = async (teamId, userId) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;
      await updateTeamDoc(teamId, {
        members: (team.members || []).filter((m) => m !== userId),
      });
    };

    const removeTeam = async (teamId) => {
      await deleteTeamDoc(teamId);
    };

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#1a1a2e",
                letterSpacing: -0.5,
              }}
            >
              Teams
            </h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>
              {teams.length} team{teams.length !== 1 ? "s" : ""}
            </p>
          </div>
          {can("manageTeam") && (
            <Btn
              onClick={() => {
                setForm({});
                setModal("createTeam");
              }}
            >
              + Create Team
            </Btn>
          )}
        </div>
        {teams.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No teams yet</p>
            {can("manageTeam") && (
              <p style={{ fontSize: 13 }}>Create a team to get started</p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {teams.map((team) => {
              const members = (team.members || [])
                .map((uid) => allUsers.find((u) => u.id === uid))
                .filter(Boolean);
              return (
                <div
                  key={team.id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #e9ecef",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                  }}
                >
                  {/* Team Header */}
                  <div
                    style={{
                      padding: "18px 22px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #f1f5f9",
                      background: "#fafaff",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          color: "#fff",
                          fontWeight: 800,
                        }}
                      >
                        {team.name[0]}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            color: "#1e293b",
                          }}
                        >
                          {team.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          {members.length} member
                          {members.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {can("manageTeam") && (
                        <>
                          <button
                            onClick={() => {
                              setForm({
                                addMemberTeamId: team.id,
                                selectedUserId: "",
                              });
                              setModal("addTeamMember");
                            }}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#eef2ff",
                              color: "#6366f1",
                              border: "1px solid #e0e7ff",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            + Add Member
                          </button>
                          <button
                            onClick={() => removeTeam(team.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#cbd5e1",
                              fontSize: 18,
                              padding: "4px 8px",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.color = "#ef4444")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.color = "#cbd5e1")
                            }
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Members List */}
                  <div style={{ padding: "6px 10px" }}>
                    {members.length === 0 ? (
                      <div
                        style={{
                          padding: "24px 20px",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        No members yet. Add users to this team.
                      </div>
                    ) : (
                      members.map((user) => (
                        <div
                          key={user.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            borderRadius: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt=""
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                  background: "#eef2ff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: "#6366f1",
                                }}
                              >
                                {user.name?.[0] || "?"}
                              </div>
                            )}
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 14,
                                  color: "#1e293b",
                                }}
                              >
                                {user.name}
                              </div>
                              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                {user.email}
                              </div>
                            </div>
                            <span
                              style={{
                                marginLeft: 8,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: ROLES[user.role]?.bg,
                                fontSize: 10,
                                fontWeight: 700,
                                color: ROLES[user.role]?.color,
                              }}
                            >
                              {ROLES[user.role]?.label}
                            </span>
                          </div>
                          {can("manageTeam") && (
                            <button
                              onClick={() =>
                                removeMemberFromTeam(team.id, user.id)
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#cbd5e1",
                                fontSize: 16,
                              }}
                              onMouseEnter={(e) =>
                                (e.target.style.color = "#ef4444")
                              }
                              onMouseLeave={(e) =>
                                (e.target.style.color = "#cbd5e1")
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Create Team Modal ─── */}
        {modal === "createTeam" && (
          <Modal title="Create Team" onClose={() => setModal(null)} width={420}>
            <Input
              label="Team Name"
              placeholder="e.g. SEO Team, Content Team"
              value={form.teamName || ""}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createTeam()}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <Btn variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Btn>
              <Btn onClick={createTeam}>Create Team</Btn>
            </div>
          </Modal>
        )}

        {/* ─── Add Member to Team Modal ─── */}
        {modal === "addTeamMember" &&
          (() => {
            const team = teams.find((t) => t.id === form.addMemberTeamId);
            const existingMembers = team?.members || [];
            const availableUsers = allUsers.filter(
              (u) => !existingMembers.includes(u.id),
            );
            return (
              <Modal
                title={`Add Member to ${team?.name || "Team"}`}
                onClose={() => setModal(null)}
                width={440}
              >
                {availableUsers.length === 0 ? (
                  <p
                    style={{
                      color: "#94a3b8",
                      fontSize: 14,
                      margin: "0 0 16px",
                    }}
                  >
                    All users are already members of this team.
                  </p>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        marginBottom: 6,
                      }}
                    >
                      Select User
                    </label>
                    <select
                      value={form.selectedUserId || ""}
                      onChange={(e) =>
                        setForm({ ...form, selectedUserId: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: 14,
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
                        fontFamily: "inherit",
                        color: "#1e293b",
                      }}
                    >
                      <option value="">Choose a user...</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <Btn variant="secondary" onClick={() => setModal(null)}>
                    Cancel
                  </Btn>
                  {availableUsers.length > 0 && (
                    <Btn onClick={() => addMemberToTeam(form.addMemberTeamId)}>
                      Add Member
                    </Btn>
                  )}
                </div>
              </Modal>
            );
          })()}
      </div>
    );
  };

  // ─── Task Templates View ───
  const TemplateView = () => {
    const [localGroups, setLocalGroups] = useState(templateGroups);
    const [dirty, setDirty] = useState(false);
    const [collapsedIds, setCollapsedIds] = useState(() => {
      const ids = new Set();
      templateGroups.forEach((g) => {
        (g.templates || []).forEach((t) => ids.add(t.id));
      });
      return ids;
    });
    const [collapsedGroups, setCollapsedGroups] = useState(
      () => new Set(templateGroups.map((g) => g.id)),
    );

    const toggleCollapse = (id) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const toggleGroupCollapse = (gid) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(gid)) next.delete(gid);
        else next.add(gid);
        return next;
      });
    };

    useEffect(() => {
      if (!dirty) {
        setLocalGroups(templateGroups);
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          templateGroups.forEach((g) => {
            (g.templates || []).forEach((t) => {
              if (!prev.has(t.id)) next.add(t.id);
            });
          });
          return next;
        });
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          templateGroups.forEach((g) => {
            if (!prev.has(g.id)) next.add(g.id);
          });
          return next;
        });
      }
    }, [templateGroups, dirty]);

    // ── Group helpers ──
    const addGroup = () => {
      let name = "New Group";
      let n = 1;
      const existing = localGroups.map((g) => g.name.toLowerCase());
      while (existing.includes(name.toLowerCase())) {
        n++;
        name = `New Group ${n}`;
      }
      setLocalGroups([...localGroups, { id: uid(), name, templates: [] }]);
      setDirty(true);
    };

    const renameGroup = (gid, newName) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const duplicate = localGroups.some(
        (g) => g.id !== gid && g.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return alert("Group name must be unique.");
      setLocalGroups(
        localGroups.map((g) => (g.id === gid ? { ...g, name: trimmed } : g)),
      );
      setDirty(true);
    };

    const removeGroup = (gid) => {
      setLocalGroups(localGroups.filter((g) => g.id !== gid));
      setDirty(true);
    };

    const moveGroup = (idx, dir) => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= localGroups.length) return;
      const arr = [...localGroups];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      setLocalGroups(arr);
      setDirty(true);
    };

    // ── Template helpers (scoped to group) ──
    const addTemplate = (gid) => {
      setLocalGroups(
        localGroups.map((g) =>
          g.id === gid
            ? {
                ...g,
                templates: [
                  ...g.templates,
                  {
                    id: uid(),
                    title: "",
                    description: "",
                    priority: "medium",
                    effort: "moderate",
                    taskType: null,
                    subtasks: [],
                  },
                ],
              }
            : g,
        ),
      );
      setDirty(true);
    };

    const updateTemplate = (gid, tid, field, value) => {
      setLocalGroups(
        localGroups.map((g) =>
          g.id === gid
            ? {
                ...g,
                templates: g.templates.map((t) =>
                  t.id === tid ? { ...t, [field]: value } : t,
                ),
              }
            : g,
        ),
      );
      setDirty(true);
    };

    const removeTemplate = (gid, tid) => {
      setLocalGroups(
        localGroups.map((g) =>
          g.id === gid
            ? { ...g, templates: g.templates.filter((t) => t.id !== tid) }
            : g,
        ),
      );
      setDirty(true);
    };

    const moveTemplate = (gid, idx, dir) => {
      setLocalGroups(
        localGroups.map((g) => {
          if (g.id !== gid) return g;
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= g.templates.length) return g;
          const arr = [...g.templates];
          [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
          return { ...g, templates: arr };
        }),
      );
      setDirty(true);
    };

    const saveTemplates = async () => {
      const valid = localGroups
        .map((g) => ({
          ...g,
          templates: g.templates.filter((t) => t.title.trim()),
        }))
        .filter((g) => g.name.trim());
      await updateTaskTemplates(valid);
      setDirty(false);
    };

    const fieldLabel = {
      fontSize: 11,
      fontWeight: 600,
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    };

    // ── Render a single template card (called as function, not component, to preserve focus) ──
    const renderTemplateCard = (grp, tmpl, idx) => {
      const isCollapsed = collapsedIds.has(tmpl.id);
      const tLen = grp.templates.length;
      return (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #f1f5f9",
            padding: isCollapsed ? "10px 14px" : 14,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={() => toggleCollapse(tmpl.id)}
          >
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                transition: "transform 0.15s",
                transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ▼
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: tmpl.title ? "#1e293b" : "#94a3b8",
              }}
            >
              {tmpl.title || "Untitled template"}
            </span>
            {isCollapsed && tmpl.taskType && TASK_TYPES[tmpl.taskType] && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: TASK_TYPES[tmpl.taskType].color,
                  background: TASK_TYPES[tmpl.taskType].bg,
                  padding: "2px 7px",
                  borderRadius: 10,
                  whiteSpace: "nowrap",
                }}
              >
                {TASK_TYPES[tmpl.taskType].label}
              </span>
            )}
            {isCollapsed && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveTemplate(grp.id, idx, -1);
                  }}
                  disabled={idx === 0}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: idx === 0 ? "default" : "pointer",
                    color: idx === 0 ? "#e2e8f0" : "#94a3b8",
                    fontSize: 11,
                    padding: "2px 3px",
                    lineHeight: 1,
                  }}
                >
                  ▲
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveTemplate(grp.id, idx, 1);
                  }}
                  disabled={idx === tLen - 1}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: idx === tLen - 1 ? "default" : "pointer",
                    color: idx === tLen - 1 ? "#e2e8f0" : "#94a3b8",
                    fontSize: 11,
                    padding: "2px 3px",
                    lineHeight: 1,
                  }}
                >
                  ▼
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTemplate(grp.id, tmpl.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#cbd5e1",
                    fontSize: 16,
                    padding: "2px 6px",
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#ef4444")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#cbd5e1")
                  }
                >
                  ×
                </button>
              </>
            )}
          </div>

          {/* Expanded content */}
          {!isCollapsed && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  paddingTop: 4,
                }}
              >
                <button
                  onClick={() => moveTemplate(grp.id, idx, -1)}
                  disabled={idx === 0}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: idx === 0 ? "default" : "pointer",
                    color: idx === 0 ? "#e2e8f0" : "#94a3b8",
                    fontSize: 11,
                    padding: "2px 3px",
                    lineHeight: 1,
                  }}
                >
                  ▲
                </button>
                <button
                  onClick={() => moveTemplate(grp.id, idx, 1)}
                  disabled={idx === tLen - 1}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: idx === tLen - 1 ? "default" : "pointer",
                    color: idx === tLen - 1 ? "#e2e8f0" : "#94a3b8",
                    fontSize: 11,
                    padding: "2px 3px",
                    lineHeight: 1,
                  }}
                >
                  ▼
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={fieldLabel}>Task Title</div>
                  <input
                    value={tmpl.title}
                    onChange={(e) =>
                      updateTemplate(grp.id, tmpl.id, "title", e.target.value)
                    }
                    placeholder="Task title..."
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      fontSize: 14,
                      fontWeight: 600,
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      outline: "none",
                      fontFamily: "inherit",
                      color: "#1e293b",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                    onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <RichTextEditor
                    label="Description (optional)"
                    value={tmpl.description || ""}
                    onChange={(v) =>
                      updateTemplate(grp.id, tmpl.id, "description", v)
                    }
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                  }}
                >
                  <div>
                    <div style={fieldLabel}>Priority</div>
                    <PrioritySelect
                      value={tmpl.priority || "medium"}
                      onChange={(v) =>
                        updateTemplate(grp.id, tmpl.id, "priority", v)
                      }
                    />
                  </div>
                  <div>
                    <div style={fieldLabel}>Effort</div>
                    <EffortSelect
                      value={tmpl.effort || "moderate"}
                      onChange={(v) =>
                        updateTemplate(grp.id, tmpl.id, "effort", v)
                      }
                    />
                  </div>
                  <div>
                    <div style={fieldLabel}>Task Type</div>
                    <TaskTypeSelect
                      value={tmpl.taskType || ""}
                      onChange={(v) =>
                        updateTemplate(grp.id, tmpl.id, "taskType", v || null)
                      }
                    />
                  </div>
                </div>
                {/* Subtasks */}
                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>Subtasks</div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {(tmpl.subtasks || []).map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 0",
                        }}
                      >
                        <span
                          style={{ fontSize: 13, color: "#1e293b", flex: 1 }}
                        >
                          {sub.title}
                        </span>
                        <button
                          onClick={() =>
                            updateTemplate(
                              grp.id,
                              tmpl.id,
                              "subtasks",
                              (tmpl.subtasks || []).filter(
                                (s) => s.id !== sub.id,
                              ),
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#cbd5e1",
                            fontSize: 14,
                            padding: "2px 6px",
                            lineHeight: 1,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "#cbd5e1")
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      <input
                        placeholder="Add subtask..."
                        style={{
                          flex: 1,
                          padding: "5px 8px",
                          fontSize: 12,
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          outline: "none",
                          fontFamily: "inherit",
                          color: "#1e293b",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "#6366f1")
                        }
                        onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.target.value.trim()) {
                            const text = e.target.value.trim();
                            updateTemplate(grp.id, tmpl.id, "subtasks", [
                              ...(tmpl.subtasks || []),
                              { id: uid(), title: text, done: false },
                            ]);
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeTemplate(grp.id, tmpl.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#cbd5e1",
                  fontSize: 18,
                  padding: "4px 8px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
              >
                ×
              </button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ padding: "32px 40px", maxWidth: 900 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 4px",
                fontSize: 22,
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Task Templates
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              Organize task templates into groups.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {dirty && <Btn onClick={saveTemplates}>Save Changes</Btn>}
            <Btn variant="secondary" onClick={addGroup}>
              + Add Group
            </Btn>
          </div>
        </div>

        {localGroups.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "#94a3b8",
              fontSize: 14,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e9ecef",
            }}
          >
            No template groups yet. Add one to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {localGroups.map((grp, gIdx) => {
              const gCollapsed = collapsedGroups.has(grp.id);
              return (
                <div
                  key={grp.id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #e9ecef",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                  }}
                >
                  {/* Group header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 18px",
                      background: "#f8fafc",
                      borderBottom: gCollapsed ? "none" : "1px solid #e9ecef",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={() => toggleGroupCollapse(grp.id)}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        transition: "transform 0.15s",
                        transform: gCollapsed
                          ? "rotate(-90deg)"
                          : "rotate(0deg)",
                        display: "inline-block",
                      }}
                    >
                      ▼
                    </span>
                    <input
                      value={grp.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setLocalGroups(
                          localGroups.map((g) =>
                            g.id === grp.id
                              ? { ...g, name: e.target.value }
                              : g,
                          ),
                        );
                        setDirty(true);
                      }}
                      onBlur={(e) => renameGroup(grp.id, e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#1e293b",
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: 6,
                        padding: "2px 6px",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                      onFocus={(e) => (
                        (e.target.style.borderColor = "#6366f1"),
                        (e.target.style.background = "#fff")
                      )}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {grp.templates.length} task
                      {grp.templates.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveGroup(gIdx, -1);
                      }}
                      disabled={gIdx === 0}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: gIdx === 0 ? "default" : "pointer",
                        color: gIdx === 0 ? "#e2e8f0" : "#94a3b8",
                        fontSize: 12,
                        padding: "2px 4px",
                        lineHeight: 1,
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveGroup(gIdx, 1);
                      }}
                      disabled={gIdx === localGroups.length - 1}
                      style={{
                        background: "none",
                        border: "none",
                        cursor:
                          gIdx === localGroups.length - 1
                            ? "default"
                            : "pointer",
                        color:
                          gIdx === localGroups.length - 1
                            ? "#e2e8f0"
                            : "#94a3b8",
                        fontSize: 12,
                        padding: "2px 4px",
                        lineHeight: 1,
                      }}
                    >
                      ▼
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeGroup(grp.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#cbd5e1",
                        fontSize: 18,
                        padding: "4px 8px",
                        lineHeight: 1,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#ef4444")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#cbd5e1")
                      }
                    >
                      ×
                    </button>
                  </div>

                  {/* Group body */}
                  {!gCollapsed && (
                    <div style={{ padding: "12px 18px 16px" }}>
                      {grp.templates.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: 24,
                            color: "#cbd5e1",
                            fontSize: 13,
                          }}
                        >
                          No templates in this group.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {grp.templates.map((tmpl, tIdx) => (
                            <div key={tmpl.id}>
                              {renderTemplateCard(grp, tmpl, tIdx)}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => addTemplate(grp.id)}
                          style={{
                            background: "none",
                            border: "1px dashed #d1d5db",
                            borderRadius: 8,
                            padding: "8px 16px",
                            cursor: "pointer",
                            color: "#6366f1",
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            width: "100%",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f8fafc")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "none")
                          }
                        >
                          + Add Task Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {dirty && (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Btn onClick={saveTemplates}>Save Changes</Btn>
          </div>
        )}
      </div>
    );
  };

  // ─── Employee View (Admin browsing employee tasks) ───
  const EmployeeView = () => {
    const emp = employees.find((e) => e.id === activeEmployee);
    if (!emp)
      return (
        <div style={{ color: "#94a3b8", padding: 40 }}>
          Select an employee from the sidebar to view their assigned tasks.
        </div>
      );
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#1a1a2e",
              }}
            >
              {emp.name}'s Tasks
            </h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>
              {empTasks.length} assigned tasks
            </p>
          </div>
          <ViewToggle />
        </div>
        {empTasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No tasks assigned</p>
          </div>
        ) : taskLayout === "calendar" ? (
          <TaskCalendar tasks={empTasks} showProject />
        ) : taskLayout === "table" ? (
          <TaskTable tasks={empTasks} showProject />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            {empTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                project={projects.find((p) => p.id === t.projectId)}
                users={allUsers}
                onUpdate={updateTask}
                onDelete={() => {}}
                isEmployee
                onOpenDetail={(id) => setDetailTask(id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── My Tasks (Employee role's own view) ───
  const MyTasksView = () => {
    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#1a1a2e",
              }}
            >
              My Tasks
            </h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>
              {visibleTasks.length} assigned tasks
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ViewToggle />
            {can("createTask") && (
              <Btn
                onClick={() => {
                  const myProj = projects.find((p) =>
                    (p.tasks || []).some((t) => t.assignee === currentUser.id) ||
                    p.projectAssignee === currentUser.id
                  );
                  setForm({ taskProject: myProj?.id || "" });
                  setModal("addTask");
                }}
              >
                + Add Task
              </Btn>
            )}
          </div>
        </div>
        {visibleTasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>
              {"No tasks assigned to you yet"}
            </p>
          </div>
        ) : taskLayout === "calendar" ? (
          <TaskCalendar tasks={visibleTasks} showProject />
        ) : taskLayout === "table" ? (
          <TaskTable
            tasks={visibleTasks}
            showProject
            isEmployee={isEmployeeRole}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            {visibleTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                project={projects.find((p) => p.id === t.projectId)}
                users={allUsers}
                onUpdate={updateTask}
                onDelete={() => {}}
                isEmployee
                onOpenDetail={(id) => setDetailTask(id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Branding Settings View (Owner only) ───
  const BrandingView = () => {
    const [form, setForm] = useState({
      appName: branding.appName || "",
      logoText: branding.logoText || "",
      logoImageUrl: branding.logoImageUrl || "",
      tagline: branding.tagline || "",
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
      setSaving(true);
      try {
        await updateBranding({
          appName: form.appName.trim() || "Asolace PM",
          logoText: form.logoText.trim() || "A",
          logoImageUrl: form.logoImageUrl.trim(),
          tagline: form.tagline.trim() || "Project Management Portal",
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error(e);
      }
      setSaving(false);
    };

    const fieldStyle = {
      width: "100%",
      padding: "10px 14px",
      border: "1.5px solid #e2e8f0",
      borderRadius: 10,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color 0.15s",
    };

    return (
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>
          Branding
        </h2>
        <p style={{ margin: "0 0 28px", color: "#64748b", fontSize: 14 }}>
          Customize the app name, logo, and tagline.
        </p>

        <div
          style={{
            maxWidth: 520,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Live Preview */}
          <div
            style={{
              padding: 20,
              background: "#1a1a2e",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {form.logoImageUrl ? (
                <img
                  src={form.logoImageUrl}
                  alt="Preview"
                  style={{ width: 40, height: 40, objectFit: "cover" }}
                />
              ) : (
                form.logoText || "A"
              )}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#e2e8f0" }}>
                {form.appName || "Asolace PM"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {form.tagline || "Project Management Portal"}
              </div>
            </div>
          </div>

          {/* App Name */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              App Name
            </label>
            <input
              style={fieldStyle}
              value={form.appName}
              onChange={(e) =>
                setForm((f) => ({ ...f, appName: e.target.value }))
              }
              placeholder="Asolace PM"
            />
          </div>

          {/* Logo Text */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Logo Text
            </label>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>
              Single character or short text shown in the logo badge. Ignored if
              a logo image URL is set.
            </p>
            <input
              style={fieldStyle}
              value={form.logoText}
              onChange={(e) =>
                setForm((f) => ({ ...f, logoText: e.target.value }))
              }
              placeholder="A"
              maxLength={3}
            />
          </div>

          {/* Logo Image URL */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Logo Image URL
            </label>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>
              Paste an image URL. When set, this replaces the logo text badge.
            </p>
            <input
              style={fieldStyle}
              value={form.logoImageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, logoImageUrl: e.target.value }))
              }
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Tagline */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 13,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Tagline
            </label>
            <input
              style={fieldStyle}
              value={form.tagline}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagline: e.target.value }))
              }
              placeholder="Project Management Portal"
            />
          </div>

          {/* Save */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 28px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Branding"}
            </button>
            {saved && (
              <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Users & Roles View (Owner only) ───
  const UsersView = () => {
    const changeRole = (userId, newRole) => {
      if (newRole === "owner") {
        const targetUser = allUsers.find((u) => u.id === userId);
        if (!targetUser || targetUser.email !== "jackhe@asolace.com") return;
      }
      updateUserRole(userId, newRole).catch(() => {});
    };
    const removeUser = (userId) => {
      deleteUserDoc(userId).catch(() => {});
    };
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#1a1a2e",
              letterSpacing: -0.5,
            }}
          >
            Users & Roles
          </h1>
          <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>
            {allUsers.length} registered users
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e9ecef",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["User", "Email", "Role", "Linked Employee", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: "#64748b",
                      textAlign: "left",
                      borderBottom: "2px solid #e9ecef",
                      background: "#f8fafc",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => {
                const linked = employees.find(
                  (e) =>
                    (e.email || "").toLowerCase() === u.email.toLowerCase(),
                );
                const isMe = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "#eef2ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#6366f1",
                          }}
                        >
                          {u.name[0]}
                        </div>
                        <div>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: "#1e293b",
                            }}
                          >
                            {u.name}
                          </span>
                          {isMe && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#94a3b8",
                                marginLeft: 6,
                              }}
                            >
                              (you)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      {u.email}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {isMe ? (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background: ROLES[u.role]?.bg,
                            color: ROLES[u.role]?.color,
                          }}
                        >
                          {ROLES[u.role]?.label}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          style={{
                            fontSize: 12,
                            padding: "5px 8px",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            background: "#fff",
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          {u.email === "jackhe@asolace.com" && (
                            <option value="owner">Owner</option>
                          )}
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </select>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: 12,
                        color: linked ? "#43a047" : "#94a3b8",
                      }}
                    >
                      {linked ? `✓ ${linked.name}` : "Not linked"}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        textAlign: "center",
                      }}
                    >
                      {!isMe && (
                        <button
                          onClick={() => removeUser(u.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#cbd5e1",
                            fontSize: 16,
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.color = "#ef4444")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.color = "#cbd5e1")
                          }
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e9ecef",
          }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 14,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Permission Levels
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
            }}
          >
            {Object.entries(ROLES).map(([key, r]) => (
              <div key={key}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: r.color,
                    marginBottom: 4,
                  }}
                >
                  {r.label}
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: "#64748b",
                    lineHeight: 1.8,
                  }}
                >
                  {key === "owner" && (
                    <>
                      <li>Full access to everything</li>
                      <li>Manage user roles</li>
                    </>
                  )}
                  {key === "manager" && (
                    <>
                      <li>Manage projects & tasks</li>
                      <li>Manage team members</li>
                      <li>Cannot change roles</li>
                    </>
                  )}
                  {key === "employee" && (
                    <>
                      <li>View assigned tasks only</li>
                      <li>Update own task status</li>
                      <li>Read-only project access</li>
                    </>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ───
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      {renderSidebar()}
      <div
        style={{
          flex: 1,
          padding: "32px 40px",
          overflowY: "auto",
          minHeight: "100vh",
        }}
      >
        {/* Owner/Manager views */}
        {currentView === "master" && can("viewMaster") && <MasterView />}
        {currentView === "project" && <ProjectView />}
        {currentView === "team" && can("viewMaster") && <TeamView />}
        {currentView === "users" && can("manageRoles") && <UsersView />}
        {currentView === "templates" && can("editProject") && <TemplateView />}
        {currentView === "branding" && can("manageRoles") && <BrandingView />}
        {currentView === "employee" && can("viewMaster") && <EmployeeView />}
        {/* Employee role views */}
        {currentView === "myTasks" && isEmployeeRole && <MyTasksView />}
        {/* Fallback */}
        {isEmployeeRole &&
          currentView !== "myTasks" &&
          currentView !== "project" && <MyTasksView />}
        {!isEmployeeRole &&
          ![
            "master",
            "project",
            "team",
            "users",
            "employee",
            "templates",
            "branding",
          ].includes(currentView) && <MasterView />}
      </div>

      {/* ─── Confirm Delete Project Modal ─── */}
      {modal === "confirmDeleteProject" && activeProj && (
        <Modal
          title="Delete Project"
          onClose={() => setModal(null)}
          width={420}
        >
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1e293b" }}>
            Are you sure you want to delete{" "}
            <strong>{activeProj.projectName}</strong>?
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>
            This will permanently remove the project and all its tasks. This
            action cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteProject(activeProj.id)}>
              Delete Project
            </Btn>
          </div>
        </Modal>
      )}

      {/* ─── Add Project Modal ─── */}
      {modal === "addProject" && (
        <Modal
          title="New Client Project"
          onClose={() => setModal(null)}
          width={580}
          preventClickaway
        >
          <ProjectFormFields form={form} setForm={setForm} users={allUsers} />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn onClick={addProject}>Create Project</Btn>
          </div>
        </Modal>
      )}

      {/* ─── Edit Project Modal ─── */}
      {modal === "editProject" && (
        <Modal
          title="Edit Client Project"
          onClose={() => {
            setForm({});
            setModal(null);
          }}
          width={580}
        >
          <ProjectFormFields
            form={form}
            setForm={autoSaveForm}
            users={allUsers}
          />
          <div
            style={{
              textAlign: "center",
              padding: "6px 0 2px",
              fontSize: 12,
              color: "#94a3b8",
              fontStyle: "italic",
            }}
          >
            Changes save automatically
          </div>
        </Modal>
      )}

      {/* ─── Add Task Modal ─── */}
      {modal === "addTask" && (
        <Modal
          title="New Task"
          onClose={() => setModal(null)}
          width={480}
          preventClickaway
        >
          {/* Template Group Picker */}
          {templateGroups.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: 14,
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #e9ecef",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 6,
                }}
              >
                Add from Template Group
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={form.templateGroup || ""}
                  onChange={(e) =>
                    setForm({ ...form, templateGroup: e.target.value })
                  }
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#fff",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                    color: "#1e293b",
                  }}
                >
                  <option value="">Select a group...</option>
                  {templateGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.templates.length} task
                      {g.templates.length !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
                <Btn
                  size="sm"
                  onClick={() =>
                    form.templateGroup &&
                    form.taskProject &&
                    addTasksFromGroup(form.templateGroup, form.taskProject)
                  }
                  disabled={!form.templateGroup || !form.taskProject}
                >
                  Add Group
                </Btn>
              </div>
              {form.templateGroup &&
                !form.taskProject &&
                currentView === "master" && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                    Select a client project below first.
                  </div>
                )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#e9ecef",
              }}
            />
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
              OR CREATE SINGLE TASK
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "#e9ecef",
              }}
            />
          </div>
          <Input
            label="Task Title"
            placeholder="What needs to be done?"
            value={form.taskTitle || ""}
            onChange={(e) => setForm({ ...form, taskTitle: e.target.value })}
            autoFocus
          />
          <RichTextEditor
            label="Description (optional)"
            value={form.taskDesc || ""}
            onChange={(html) => setForm({ ...form, taskDesc: html })}
          />
          {(currentView === "master" || currentView === "myTasks") && (
            <Select
              label="Client Project"
              value={form.taskProject || ""}
              onChange={(e) =>
                setForm({ ...form, taskProject: e.target.value })
              }
            >
              <option value="">Select project...</option>
              {(isEmployeeRole
                ? projects.filter((p) =>
                    (p.tasks || []).some((t) => t.assignee === currentUser.id) ||
                    p.projectAssignee === currentUser.id
                  )
                : projects
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 5,
                }}
              >
                Priority
              </div>
              <PrioritySelect
                value={form.taskPriority || "medium"}
                onChange={(v) => setForm({ ...form, taskPriority: v })}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 5,
                }}
              >
                Effort
              </div>
              <EffortSelect
                value={form.taskEffort || "moderate"}
                onChange={(v) => setForm({ ...form, taskEffort: v })}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 5,
                }}
              >
                Assign To
              </div>
              <select
                value={form.taskAssignee || ""}
                onChange={(e) =>
                  setForm({ ...form, taskAssignee: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1e293b",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#fff",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="">Unassigned</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: 5,
                }}
              >
                Due Date
              </div>
              <DateCell
                value={form.taskDueDate || ""}
                onChange={(v) => setForm({ ...form, taskDueDate: v })}
              />
            </div>
          </div>
          {/* Task Type */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 5,
              }}
            >
              Task Type
            </div>
            <TaskTypeSelect
              value={form.taskType || ""}
              onChange={(v) => setForm({ ...form, taskType: v })}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 8,
            }}
          >
            <Btn variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Btn>
            <Btn onClick={addTask}>Create Task</Btn>
          </div>
        </Modal>
      )}
      {detailTask &&
        (() => {
          const task = allTasks.find((t) => t.id === detailTask);
          if (!task) return null;
          const proj = projects.find((p) => p.id === task.projectId);
          return (
            <TaskDetailModal
              task={task}
              project={proj}
              allUsers={allUsers}
              currentUser={currentUser}
              onUpdate={updateTask}
              onClose={() => setDetailTask(null)}
              canEdit={!isEmployeeRole}
            />
          );
        })()}
    </div>
  );
}
