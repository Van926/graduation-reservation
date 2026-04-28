import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import "./App.css";
import "./RegistrationsPage.css";

const API_BASE_URL    = process.env.REACT_APP_API_URL      || "https://grad-reservation-backend.vercel.app";
const ADMIN_PASSWORD  = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" }); }
  catch { return String(iso); }
};

// Shared card wrapper used across login screens
const Card = ({ children, maxWidth = 420 }) => (
  <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13", padding: 24, fontFamily: "Arial, sans-serif" }}>
    <div style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: 20, padding: "48px 36px", maxWidth, width: "100%", textAlign: "center" }}>
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ScanPage — shown when URL has ?parent=...
// ─────────────────────────────────────────────────────────────────────────────
function ScanPage({ parentName }) {
  const [status, setStatus]       = useState("loading");
  const [message, setMessage]     = useState("Validating your QR code…");
  const [scannedAt, setScannedAt] = useState(null);

  useEffect(() => {
    if (!parentName) { setStatus("error"); setMessage("No parent information found in this QR code."); return; }
    fetch(`${API_BASE_URL}/api/scan-qr`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentName }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok)            { setStatus("error");    setMessage(d.error || "Failed to validate."); }
        else if (d.inactive){ setStatus("inactive"); setScannedAt(d.scannedAt); setMessage("This QR code has already been used."); }
        else if (d.success) { setStatus("success");  setMessage("Entry approved. Welcome to the LCC Graduation Ceremony!"); }
        else                { setStatus("error");    setMessage(d.error || "Unexpected response."); }
      })
      .catch(() => { setStatus("error"); setMessage("Connection error. Please show this QR code to the registration desk."); });
  }, [parentName]);

  const CFG = {
    loading:  { icon: "○", color: "#888899", label: "Checking…" },
    success:  { icon: "✓", color: "#22c55e", label: "Entry Approved" },
    inactive: { icon: "⚠", color: "#f59e0b", label: "Already Used" },
    error:    { icon: "✕", color: "#ef4444", label: "Invalid QR Code" },
  };
  const cfg = CFG[status] || CFG.error;

  return (
    <Card>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: cfg.color + "18", border: "2px solid " + cfg.color + "40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 36, color: cfg.color }}>{cfg.icon}</div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>LCC Graduation Ceremony</p>
      <h1 style={{ fontSize: 28, color: "#f0f0f8", marginBottom: 14, lineHeight: 1.2 }}>{cfg.label}</h1>
      <p style={{ fontSize: 15, color: "#888899", lineHeight: 1.6, marginBottom: 32 }}>{message}</p>
      {(status === "success" || status === "inactive") && (
        <div style={{ background: "#12121a", border: "1px solid #22222e", borderRadius: 12, padding: 20, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>Guest</span>
            <span style={{ fontSize: 14, color: "#c8c8de" }}>{parentName}</span>
          </div>
          {status === "inactive" && scannedAt && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1e1e28" }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>First scanned</span>
              <span style={{ fontSize: 14, color: "#c8c8de" }}>{fmt(scannedAt)}</span>
            </div>
          )}
        </div>
      )}
      <p style={{ marginTop: 28, fontSize: 12, color: "#33334a" }}>{fmt(new Date().toISOString())}</p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage — role selector + credential entry
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({ onStudentLogin, onAdminLogin }) {
  const [role, setRole]       = useState(null);       // null | "student" | "admin"
  const [input, setInput]     = useState("");
  const [show, setShow]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shake = (msg) => {
    setError(msg); setShaking(true); setInput("");
    setTimeout(() => setShaking(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (role === "admin") {
      if (input === ADMIN_PASSWORD) onAdminLogin();
      else shake("Incorrect password. Please try again.");
      return;
    }

    // Student — verify student number exists in DB
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/check-student-number`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber: input }),
      });
      const data = await res.json();
      if (!res.ok) { shake("Server error. Please try again."); return; }
      if (!data.exists) { shake("Student number not found. Please check your number."); return; }
      onStudentLogin({ studentNumber: input, studentName: data.student_name || "", course: data.course || "" });
    } catch {
      shake("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        .login-shake { animation: shake 0.5s ease; }
        .role-btn { transition: all 0.2s; cursor: pointer; }
        .role-btn:hover { transform: translateY(-2px); }
        .auth-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .submit-login:hover:not(:disabled) { background: #4f46e5 !important; }
        .back-link:hover { color: #888899 !important; }
      `}</style>

      <div className={shaking ? "login-shake" : ""} style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: 20, padding: "48px 36px", maxWidth: 420, width: "100%" }}>

        {/* Logo / header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 8 }}>LCC Graduation</p>
          <h1 style={{ fontSize: 26, color: "#f0f0f8", margin: 0, fontWeight: 700 }}>
            {role === null ? "Welcome" : role === "student" ? "Student Login" : "Admin Login"}
          </h1>
          {role === null && <p style={{ fontSize: 14, color: "#666677", marginTop: 8 }}>Choose how you'd like to continue.</p>}
        </div>

        {/* Role selector */}
        {role === null && (
          <div style={{ display: "flex", gap: 12 }}>
            <button className="role-btn" onClick={() => setRole("student")} style={{ flex: 1, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: "20px 12px", color: "#e0e0f0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎓</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f8", marginBottom: 4 }}>Student</div>
              <div style={{ fontSize: 12, color: "#666677" }}>Register &amp; view your QR codes</div>
            </button>
            <button className="role-btn" onClick={() => setRole("admin")} style={{ flex: 1, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, padding: "20px 12px", color: "#e0e0f0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f8", marginBottom: 4 }}>Admin</div>
              <div style={{ fontSize: 12, color: "#666677" }}>Manage registrations</div>
            </button>
          </div>
        )}

        {/* Credential form */}
        {role !== null && (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#888899", marginBottom: 8, textAlign: "left" }}>
              {role === "student" ? "Student Number" : "Admin Password"}
            </label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                className="auth-input"
                type={role === "admin" && !show ? "password" : "text"}
                placeholder={role === "student" ? "Enter your student number" : "Enter admin password"}
                value={input}
                onChange={(e) => { setInput(role === "student" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value); setError(""); }}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", background: "#12121a", border: "1px solid #2a2a35", borderRadius: 10, padding: role === "admin" ? "12px 44px 12px 14px" : "12px 14px", color: "#e0e0f0", fontSize: 15 }}
              />
              {role === "admin" && (
                <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#555566", fontSize: 16, padding: 0 }}>
                  {show ? "🙈" : "👁"}
                </button>
              )}
            </div>

            {error && <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12, textAlign: "left" }}>{error}</p>}

            <button className="submit-login" type="submit" disabled={!input.trim() || loading}
              style={{ width: "100%", background: role === "admin" ? "#6366f1" : "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: (!input.trim() || loading) ? "not-allowed" : "pointer", opacity: (!input.trim() || loading) ? 0.5 : 1, transition: "background 0.15s" }}>
              {loading ? "Checking…" : role === "student" ? "Continue" : "Unlock"}
            </button>

            <button type="button" className="back-link" onClick={() => { setRole(null); setInput(""); setError(""); }}
              style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: "#44445a", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}>
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminPage — registrations table + Excel import
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({ onLogout }) {
  const [tab, setTab]                 = useState("registrations"); // "registrations" | "import"
  const [filter, setFilter]           = useState("all");
  const [rows, setRows]               = useState([]);
  const [counts, setCounts]           = useState({ all: 0, scanned: 0, unscanned: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  // Import state
  const [importFile, setImportFile]       = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError]     = useState("");
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState(null);
  const [markingId, setMarkingId]         = useState(null); // "studentNumber-parentSlot" being marked

  // Load SheetJS
  useEffect(() => {
    if (window.XLSX) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_BASE_URL}/api/registrations?filter=all`),
        fetch(`${API_BASE_URL}/api/registrations?filter=scanned`),
        fetch(`${API_BASE_URL}/api/registrations?filter=unscanned`),
      ]);
      if (!r1.ok) throw new Error("Failed to fetch registrations.");
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      setRows(d1.data || []);
      setCounts({ all: d1.total || 0, scanned: d2.total || 0, unscanned: d3.total || 0 });
      setLastRefresh(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkScanned = async (row) => {
    const id = `${row.student_number}-${row.parent_slot}`;
    if (!window.confirm(`Mark "${row.parent_name}" as scanned?\n\nStudent: ${row.student_name} (${row.student_number})\n\nThis action cannot be undone.`)) return;

    setMarkingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mark-scanned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentName: row.parent_name, studentNumber: row.student_number }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to mark as scanned.'); return; }

      // Optimistic update — reflect change immediately without full re-fetch
      setRows(prev => prev.map(r => {
        if (r.student_number === row.student_number && r.parent_slot === row.parent_slot) {
          return { ...r, scanned: true, scanned_at: data.scanned_at };
        }
        return r;
      }));
      setCounts(prev => ({ ...prev, scanned: prev.scanned + 1, unscanned: prev.unscanned - 1 }));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setMarkingId(null);
    }
  };



  const visible = rows
    .filter(r => filter === "scanned" ? r.scanned : filter === "unscanned" ? !r.scanned : true)
    .filter(r => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return ["student_name","student_number","parent_name","course"].some(k => (r[k]||"").toLowerCase().includes(q));
    });

  const exportToExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("Excel export is still loading, please try again."); return; }
    const ws = XLSX.utils.json_to_sheet(visible.map(r => ({
      "Student Name": r.student_name || "", "Student Number": r.student_number || "",
      "Course": r.course || "", "Email": r.email || "", "Contact Number": r.contact_number || "",
      "Parent Name": r.parent_name || "", "Slot": r.parent_slot || "",
      "Status": r.scanned ? "Scanned" : "Not Yet Scanned",
      "Scanned At": r.scanned ? fmt(r.scanned_at) : "", "Registered At": fmt(r.registered_at),
    })));
    ws["!cols"] = [24,16,10,28,16,24,10,20,22,22].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, filter === "scanned" ? "Scanned" : filter === "unscanned" ? "Not Yet Scanned" : "All Registrations");
    XLSX.writeFile(wb, `lcc-graduation-${filter}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── Excel import ───────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file); setImportError(""); setImportResult(null); setImportPreview([]);

    const XLSX = window.XLSX;
    if (!XLSX) { setImportError("SheetJS is still loading. Please try again in a moment."); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (raw.length === 0) { setImportError("The file appears to be empty."); return; }

        // Flexible column mapping — accept common variations
        const normalize = (row) => {
          const keys = Object.keys(row);
          const find = (...candidates) => {
            for (const c of candidates) {
              const k = keys.find(k => k.toLowerCase().replace(/[\s_]/g,"").includes(c));
              if (k) return String(row[k]).trim();
            }
            return "";
          };
          return {
            student_name:   find("studentname","name","student"),
            student_number: find("studentnumber","studentno","number","no","id"),
            course:         find("course","program","dept"),
          };
        };

        const preview = raw.slice(0, 200).map(normalize).filter(r => r.student_name || r.student_number);
        if (preview.length === 0) {
          setImportError("Could not find student data. Make sure columns are named: Student Name, Student Number, Course.");
          return;
        }
        setImportPreview(preview);
      } catch (err) {
        setImportError("Failed to read file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true); setImportError(""); setImportResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/import-students`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: importPreview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setImportResult(data);
      setImportFile(null); setImportPreview([]);
      fetchData(); // refresh registrations table
    } catch (err) { setImportError(err.message); }
    finally { setImporting(false); }
  };

  const TABS_FILTER = [
    { key: "all",       label: "All",             count: counts.all       },
    { key: "unscanned", label: "Not Yet Scanned",  count: counts.unscanned },
    { key: "scanned",   label: "Already Scanned",  count: counts.scanned   },
  ];
  const COLS = ["Student Name","Student No.","Course","Parent Name","Slot","Status","Scanned At","Registered At","Action"];

  return (
    <div className="reg-page">
      <div className="reg-inner">

        {/* Header */}
        <div className="reg-header">
          <h1 className="reg-title">🎓 Admin — LCC Graduation</h1>
          <button className="reg-back-btn" onClick={onLogout}>Logout</button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {[["registrations","📋 Registrations"],["import","📥 Import Students"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: "9px 20px", borderRadius: 999, border: `1px solid ${tab === key ? "#6366f1" : "#2a2a35"}`, background: tab === key ? "rgba(99,102,241,0.12)" : "transparent", color: tab === key ? "#6366f1" : "#888899", cursor: "pointer", fontWeight: tab === key ? 600 : 400, fontSize: 14 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Registrations tab ── */}
        {tab === "registrations" && (
          <>
            <div className="reg-tabs">
              {TABS_FILTER.map(({ key, label, count }) => (
                <button key={key} className={`reg-tab${filter === key ? " active-" + key : ""}`} onClick={() => setFilter(key)}>
                  {label} ({count})
                </button>
              ))}
            </div>
            <div className="reg-toolbar">
              <input className="reg-search" placeholder="Search by student, parent, course…" value={search} onChange={e => setSearch(e.target.value)} />
              <button className="reg-refresh-btn" onClick={fetchData} disabled={loading}>{loading ? "…" : "↻ Refresh"}</button>
              <button className="reg-export-btn" onClick={exportToExcel} disabled={visible.length === 0}>↓ Export to Excel ({visible.length})</button>
            </div>
            {error   ? <p className="reg-error">Error: {error}</p>
            : loading ? <p className="reg-state">Loading…</p>
            : visible.length === 0 ? <p className="reg-state">No records found.</p>
            : (
              <div className="reg-table-wrap">
                <table className="reg-table">
                  <thead><tr>{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {visible.map(r => (
                      <tr key={`${r.student_number}-${r.parent_slot}`}>
                        <td>{r.student_name}</td><td>{r.student_number}</td><td>{r.course}</td>
                        <td>{r.parent_name}</td>
                        <td><span className="slot-label">{r.parent_slot}</span></td>
                        <td><span className={r.scanned ? "badge-scanned" : "badge-pending"}>{r.scanned ? "✓ Scanned" : "Pending"}</span></td>
                        <td>{r.scanned ? fmt(r.scanned_at) : "—"}</td>
                        <td>{fmt(r.registered_at)}</td>
                        <td>
                          {!r.scanned && (
                            <button
                              onClick={() => handleMarkScanned(r)}
                              disabled={markingId === `${r.student_number}-${r.parent_slot}`}
                              style={{
                                background: "rgba(34,197,94,0.12)",
                                border: "1px solid rgba(34,197,94,0.3)",
                                color: "#22c55e",
                                borderRadius: 6,
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: markingId === `${r.student_number}-${r.parent_slot}` ? "not-allowed" : "pointer",
                                opacity: markingId === `${r.student_number}-${r.parent_slot}` ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {markingId === `${r.student_number}-${r.parent_slot}` ? "…" : "✓ Mark Scanned"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="reg-footer">
              <span>Showing {visible.length} of {counts.all} total entries</span>
              {lastRefresh && <span>Last updated: {fmt(lastRefresh.toISOString())}</span>}
            </div>
          </>
        )}

        {/* ── Import tab ── */}
        {tab === "import" && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: 14, padding: 28, marginBottom: 20 }}>
              <h2 style={{ color: "#f0f0f8", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Import Students from Excel</h2>
              <p style={{ color: "#666677", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Upload an <strong style={{ color: "#c8c8de" }}>.xlsx</strong> or <strong style={{ color: "#c8c8de" }}>.csv</strong> file with columns:<br />
                <code style={{ background: "#12121a", padding: "2px 8px", borderRadius: 4, fontSize: 13, color: "#6366f1" }}>Student Name</code>{" "}
                <code style={{ background: "#12121a", padding: "2px 8px", borderRadius: 4, fontSize: 13, color: "#6366f1" }}>Student Number</code>{" "}
                <code style={{ background: "#12121a", padding: "2px 8px", borderRadius: 4, fontSize: 13, color: "#6366f1" }}>Course</code>
                <br /><span style={{ fontSize: 13, color: "#555566", marginTop: 4, display: "inline-block" }}>Duplicate student numbers are automatically skipped.</span>
              </p>

              {/* File input */}
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                  📂 Choose File
                </div>
                <span style={{ color: "#666677", fontSize: 14 }}>{importFile ? importFile.name : "No file chosen"}</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: "none" }} />
              </label>

              {importError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{importError}</p>}
            </div>

            {/* Preview table */}
            {importPreview.length > 0 && (
              <div style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ color: "#f0f0f8", fontSize: 15, fontWeight: 700, margin: 0 }}>
                    Preview — {importPreview.length} student{importPreview.length !== 1 ? "s" : ""} found
                  </h3>
                  <button onClick={handleImport} disabled={importing}
                    style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1 }}>
                    {importing ? "Importing…" : `Import ${importPreview.length} Students`}
                  </button>
                </div>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #2a2a35" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["#","Student Name","Student Number","Course"].map(h => (
                          <th key={h} style={{ background: "#12121a", color: "#555566", padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #1e1e28", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a22", color: "#555566", background: i % 2 === 0 ? "#1a1a22" : "#16161e" }}>{i + 1}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a22", color: "#e0e0f0", background: i % 2 === 0 ? "#1a1a22" : "#16161e" }}>{r.student_name || <span style={{ color: "#ef4444" }}>Missing</span>}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a22", color: "#e0e0f0", background: i % 2 === 0 ? "#1a1a22" : "#16161e" }}>{r.student_number || <span style={{ color: "#ef4444" }}>Missing</span>}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a22", color: "#e0e0f0", background: i % 2 === 0 ? "#1a1a22" : "#16161e" }}>{r.course || <span style={{ color: "#f59e0b" }}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.length > 10 && (
                  <p style={{ color: "#555566", fontSize: 12, marginTop: 10 }}>Showing 10 of {importPreview.length} rows. All rows will be imported.</p>
                )}
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 14, padding: 24 }}>
                <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>✓ Import Complete</p>
                <p style={{ color: "#c8c8de", fontSize: 14 }}>
                  <strong>{importResult.imported}</strong> student{importResult.imported !== 1 ? "s" : ""} imported successfully.
                  {importResult.skipped > 0 && <span style={{ color: "#f59e0b" }}> {importResult.skipped} skipped (duplicate student numbers).</span>}
                </p>
              </div>
            )}

            {/* Template download */}
            <div style={{ marginTop: 20, padding: 16, background: "#12121a", borderRadius: 10, border: "1px solid #1e1e28" }}>
              <p style={{ color: "#555566", fontSize: 13, marginBottom: 10 }}>Need a template? Download a sample Excel file:</p>
              <button onClick={() => {
                const XLSX = window.XLSX;
                if (!XLSX) { alert("Still loading, try again."); return; }
                const ws = XLSX.utils.json_to_sheet([
                  { "Student Name": "Juan dela Cruz", "Student Number": "2021-00001", "Course": "CBA" },
                  { "Student Name": "Maria Santos",   "Student Number": "2021-00002", "Course": "CELA" },
                ]);
                ws["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Students");
                XLSX.writeFile(wb, "lcc-students-template.xlsx");
              }} style={{ background: "transparent", border: "1px solid #2a2a35", color: "#888899", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer" }}>
                ↓ Download Template
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StudentPage({ studentInfo, onLogout }) {
  const initialStudentNumber = studentInfo?.studentNumber || "";
  const hasRegistration      = studentInfo?.hasRegistration || false;

  // ── view | "form" (new registration) | "edit" (editing existing) | "qr" ──
  const [mode, setMode]                 = useState("form");
  const [studentName, setStudentName]   = useState(studentInfo?.studentName    || "");
  const [studentNumber]                 = useState(initialStudentNumber);
  const [course, setCourse]             = useState(studentInfo?.course         || "");
  const [email, setEmail]               = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [parent1, setParent1]           = useState("");
  const [parent2, setParent2]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [emailSent, setEmailSent]       = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [parent1Scanned, setParent1Scanned]     = useState(false);
  const [parent2Scanned, setParent2Scanned]     = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt] = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [originalData, setOriginalData] = useState({});
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [registrationExists, setRegistrationExists] = useState(false);

  // Edit mode — working copies
  const [editParent1, setEditParent1] = useState("");
  const [editParent2, setEditParent2] = useState("");
  const [editEmail, setEditEmail]     = useState("");
  const [editContact, setEditContact] = useState("");

  const qrValueParent1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrValueParent2 = parent2 ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent2)}` : null;

  // Helper function for formatting dates
  const fmt = (d) => d ? new Date(d).toLocaleString() : "";

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);

  // Fetch ALL registration data on login
  useEffect(() => {
    const fetchRegistrationData = async () => {
      if (!studentNumber) {
        console.log('No student number available');
        setDataLoaded(true);
        return;
      }
      
      console.log('Fetching registration data for:', studentNumber);
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/check-student-number`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentNumber }),
        });
        
        const data = await res.json();
        console.log('Received data:', data);
        
        if (data.exists) {
          setRegistrationExists(true);
          console.log('Parent1 from DB:', data.parent1_name);
          console.log('Parent2 from DB:', data.parent2_name);
          
          // Populate ALL fields from database
          setStudentName(data.student_name || "");
          setCourse(data.course || "");
          setEmail(data.email || "");
          setContactNumber(data.contact_number || "");
          setParent1(data.parent1_name || "");
          setParent2(data.parent2_name || "");
          setParent1Scanned(data.parent1_scanned || false);
          setParent2Scanned(data.parent2_scanned || false);
          
          // Store original data for comparison
          setOriginalData({
            email: data.email || "",
            contact_number: data.contact_number || "",
            parent1_name: data.parent1_name || "",
            parent2_name: data.parent2_name || ""
          });
          
          // Set edit copies
          setEditParent1(data.parent1_name || "");
          setEditParent2(data.parent2_name || "");
          setEditEmail(data.email || "");
          setEditContact(data.contact_number || "");
          
          // If parent names exist, show update prompt
          if (data.parent1_name) {
            console.log('Parent names detected, showing update prompt');
            setShowUpdatePrompt(true);
          } else {
            setMode("form");
          }
        } else {
          console.log('No existing registration found');
          setRegistrationExists(false);
          setMode("form");
        }
        setDataLoaded(true);
      } catch (err) {
        console.error("Error fetching registration data:", err);
        setDataLoaded(true);
      }
    };

    if (!dataLoaded) {
      fetchRegistrationData();
    }
  }, [studentNumber, dataLoaded]);

  // Poll QR scan status in view/qr mode
  useEffect(() => {
    if (mode !== "view" && mode !== "qr") return;
    if (!parent1) return;
    
    const check = async () => {
      try {
        const r1 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentName: parent1 }),
        });
        if (r1.ok) { 
          const d = await r1.json(); 
          setParent1Scanned(d.scanned); 
          setParent1ScannedAt(d.scannedAt); 
        }
        
        if (parent2) {
          const r2 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentName: parent2 }),
          });
          if (r2.ok) { 
            const d = await r2.json(); 
            setParent2Scanned(d.scanned); 
            setParent2ScannedAt(d.scannedAt); 
          }
        }
      } catch (e) { console.error("QR scan check error:", e); }
    };
    
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [mode, parent1, parent2]);

  // ── New registration submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isApiConnected) { alert("Backend server is not connected."); return; }
    setLoading(true);
    try {
      const qr1 = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2 = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;
      const saveRes = await fetch(`${API_BASE_URL}/api/save-registration`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          studentName, studentNumber, course, email, contactNumber, 
          parent1, parent2, qrCodeParent1: qr1, qrCodeParent2: qr2 
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save.");
      
      // Show different message based on whether it was an update or first-time registration
      if (saveData.isUpdate) {
        alert("Your registration has been updated successfully!");
      } else {
        alert("Your registration has been saved successfully!");
      }
      
      // Update the original data after successful save
      setOriginalData({
        email: email,
        contact_number: contactNumber,
        parent1_name: parent1,
        parent2_name: parent2
      });
      
      setMode("qr");
    } catch (err) { alert("Registration failed: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Check if any data has been modified ──────────────────────────────────
  const hasChanges = () => {
    return (
      editEmail !== originalData.email ||
      editContact !== originalData.contact_number ||
      editParent1 !== originalData.parent1_name ||
      editParent2 !== originalData.parent2_name
    );
  };

  // ── Edit save — update all editable fields ──────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editParent1.trim()) { alert("Parent 1 name is required."); return; }
    if (!editEmail.trim()) { alert("Email is required."); return; }
    if (!editContact.trim()) { alert("Contact number is required."); return; }
    
    if (!hasChanges()) {
      alert("No changes detected. Please modify at least one field.");
      return;
    }
    
    if (!window.confirm("Update your information? New QR codes will be generated.")) return;
    
    setLoading(true);
    try {
      const newQrVal1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(editParent1)}`;
      const newQrVal2 = editParent2 ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(editParent2)}` : null;
      const qr1 = await QRCodeLib.toDataURL(newQrVal1);
      const qr2 = newQrVal2 ? await QRCodeLib.toDataURL(newQrVal2) : null;

      const res = await fetch(`${API_BASE_URL}/api/update-registration`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber,
          email: editEmail,
          contactNumber: editContact,
          parent1: editParent1,
          parent2: editParent2,
          qrCodeParent1: qr1,
          qrCodeParent2: qr2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update.");

      // Commit edits into live state
      setParent1(editParent1);
      setParent2(editParent2);
      setEmail(editEmail);
      setContactNumber(editContact);
      
      // Update original data
      setOriginalData({
        email: editEmail,
        contact_number: editContact,
        parent1_name: editParent1,
        parent2_name: editParent2
      });
      
      setParent1Scanned(false); 
      setParent1ScannedAt(null);
      setParent2Scanned(false); 
      setParent2ScannedAt(null);
      setEmailSent(false);
      setIsEditing(false);
      setMode("qr");
      
      alert("Your information has been updated successfully!");
    } catch (err) { alert("Update failed: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Send email ────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const qr1 = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2 = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;
      const res = await fetch(`${API_BASE_URL}/api/send-qr-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, email, parent1, parent2, qrDataParent1: qr1, qrDataParent2: qr2 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send email.");
      setEmailSent(true);
      alert("QR codes sent to your email successfully!");
    } catch (err) { alert("Error sending email: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Cancel edit and restore original values ──────────────────────────────
  const handleCancelEdit = () => {
    setEditParent1(originalData.parent1_name);
    setEditParent2(originalData.parent2_name);
    setEditEmail(originalData.email);
    setEditContact(originalData.contact_number);
    setIsEditing(false);
  };

  // ── Go back to summary (view mode) ───────────────────────────────────────
  const handleBackToSummary = () => {
    setMode("view");
    setIsEditing(false);
  };

  // ── Handle update prompt choices ─────────────────────────────────────────
  const handleViewOnly = () => {
    setShowUpdatePrompt(false);
    setMode("view");
  };

  const handleUpdateInfo = () => {
    setShowUpdatePrompt(false);
    setIsEditing(true);
    setMode("view");
  };

  // ── Shared locked field style ─────────────────────────────────────────────
  const lockedStyle = { background: "#12121a", color: "#555566", cursor: "not-allowed", borderColor: "#1e1e28" };

  // Show loading while fetching data
  if (!dataLoaded) {
    return (
      <div className="app-container">
        <div className="form-card">
          <p>Loading your registration data...</p>
        </div>
      </div>
    );
  }

  // Show update prompt if parent names exist
  if (showUpdatePrompt) {
    return (
      <div className="app-container">
        <div className="form-card">
          <div style={{ textAlign: "center" }}>
            <h1 className="form-title" style={{ marginBottom: 20 }}>Welcome Back, {studentName}!</h1>
            <p className="form-description" style={{ marginBottom: 30 }}>
              You have already registered for the graduation ceremony.
            </p>
            
            <div style={{ background: "#12121a", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "left" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>Your Current Registration</p>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Student Name</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{studentName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Student Number</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{studentNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Course</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{course}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Email</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{email}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Contact Number</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{contactNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Parent 1</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{parent1}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}>
                <span style={{ fontSize: 13, color: "#555566" }}>Parent 2</span>
                <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{parent2 || "Not provided"}</span>
              </div>
            </div>
            
            <p className="form-description" style={{ marginBottom: 20 }}>
              What would you like to do?
            </p>
            
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button 
                onClick={handleUpdateInfo}
                style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                ✏️ Update My Information
              </button>
              <button 
                onClick={handleViewOnly}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                👁️ View My QR Codes
              </button>
              <button 
                onClick={onLogout}
                style={{ background: "transparent", border: "1px solid #2a2a35", color: "#888899", borderRadius: 8, padding: "12px 0", fontSize: 14, cursor: "pointer" }}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          <h1 className="form-title" style={{ margin: 0 }}>LCC Graduation Reservation</h1>
          <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #2a2a35", color: "#888899", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Logout</button>
        </div>

        {!isApiConnected && <div className="warning-message">⚠️ Connecting to server… Please wait.</div>}

        {/* ── VIEW mode: existing registration summary ── */}
        {mode === "view" && !isEditing && (
          <div>
            <p className="form-description">Your registration details are shown below.</p>

            {/* Student info block */}
            <div style={{ background: "#12121a", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>Student Information</p>
              {[["Name", studentName], ["Student Number", studentNumber], ["Course", course]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                  <span style={{ fontSize: 13, color: "#555566" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#c8c8de", fontWeight: 500 }}>{val || "—"}</span>
                </div>
              ))}
            </div>

            {/* Contact Info Block */}
            <div style={{ background: "#12121a", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>Contact Information</p>
              {[["Email", email || "—"], ["Contact Number", contactNumber || "—"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                  <span style={{ fontSize: 13, color: "#555566" }}>{label}</span>
                  <span style={{ fontSize: 13, color: val === "—" ? "#333344" : "#c8c8de", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Parent info block */}
            <div style={{ background: "#12121a", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555566", margin: 0 }}>Registered Parents / Guardians</p>
              </div>
              {[["Parent 1", parent1], ["Parent 2", parent2 || "—"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                  <span style={{ fontSize: 13, color: "#555566" }}>{label}</span>
                  <span style={{ fontSize: 13, color: val === "—" ? "#333344" : "#c8c8de", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              {parent1Scanned && <div style={{ marginTop: 10, fontSize: 12, color: "#22c55e" }}>✓ Parent 1 has been scanned</div>}
              {parent2Scanned && <div style={{ marginTop: 5, fontSize: 12, color: "#22c55e" }}>✓ Parent 2 has been scanned</div>}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setMode("qr")}
                style={{ flex: 1, background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                View QR Codes
              </button>
              <button onClick={() => setIsEditing(true)}
                style={{ flex: 1, background: "transparent", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ✏️ Edit Information
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT mode inline ── */}
        {isEditing && (
          <div>
            <p className="form-description">Edit your registration information. New QR codes will be generated.</p>
            
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#f59e0b" }}>
              ⚠️ Editing will generate new QR codes. Previously shared QR codes will no longer work.
            </div>

            <form onSubmit={handleEditSave} className="form">
              <label className="form-label">Student Name</label>
              <input type="text" value={studentName || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Student Number</label>
              <input type="text" value={studentNumber || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Course</label>
              <input type="text" value={course || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Email <span className="required-asterisk">*</span></label>
              <input 
                type="email" 
                placeholder="your.email@example.com" 
                value={editEmail} 
                onChange={e => setEditEmail(e.target.value)} 
                className="form-input" 
                required 
              />

              <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
              <input 
                type="tel" 
                placeholder="09123456789" 
                value={editContact} 
                onChange={e => setEditContact(e.target.value.replace(/[^0-9]/g, ""))} 
                className="form-input" 
                required 
              />

              <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
              <input 
                type="text" 
                placeholder="Parent/Guardian 1 full name" 
                value={editParent1} 
                onChange={e => setEditParent1(e.target.value)} 
                className="form-input" 
                required 
              />

              <label className="form-label">Parent 2 Name (Optional)</label>
              <input 
                type="text" 
                placeholder="Parent/Guardian 2 full name" 
                value={editParent2} 
                onChange={e => setEditParent2(e.target.value)} 
                className="form-input" 
              />

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={handleCancelEdit}
                  style={{ flex: 1, background: "transparent", border: "1px solid #2a2a35", color: "#888899", borderRadius: 8, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !editParent1.trim() || !editEmail.trim() || !editContact.trim() || !hasChanges()}
                  style={{ flex: 2, background: "#f59e0b", color: "#111", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, 
                    cursor: (!loading && editParent1.trim() && editEmail.trim() && editContact.trim() && hasChanges()) ? "pointer" : "not-allowed", 
                    opacity: (!loading && editParent1.trim() && editEmail.trim() && editContact.trim() && hasChanges()) ? 1 : 0.5 }}>
                  {loading ? "Saving…" : "Save Changes & Generate New QR Codes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM mode: new registration ── */}
        {mode === "form" && (
          <div>
            <p className="form-description">
              Fill out the form below to reserve your spot for the LCC graduation ceremony.
              You can reserve up to 2 spots only.
            </p>
            <form onSubmit={handleSubmit} className="form">
              <label className="form-label">Student Name</label>
              <input type="text" value={studentName || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Student Number</label>
              <input type="text" value={studentNumber || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Course</label>
              <input type="text" value={course || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Email <span className="required-asterisk">*</span></label>
              <input type="email" placeholder="your.email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="form-input" required />

              <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
              <input type="tel" placeholder="09123456789" value={contactNumber} onChange={e => setContactNumber(e.target.value.replace(/[^0-9]/g, ""))} className="form-input" required />

              <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
              <input type="text" placeholder="Parent/Guardian 1 full name" value={parent1} onChange={e => setParent1(e.target.value)} className="form-input" required />

              <label className="form-label">Parent 2 Name (Optional)</label>
              <input type="text" placeholder="Parent/Guardian 2 full name" value={parent2} onChange={e => setParent2(e.target.value)} className="form-input" />

              <button type="submit" className="submit-btn" disabled={!isApiConnected || loading}>
                {loading ? "Generating…" : "Generate QR Code"}
              </button>
            </form>
          </div>
        )}

        {/* ── QR mode ── */}
        {mode === "qr" && (
          <div className="qr-section">
            <p className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</p>
            <div className="qr-container">
              <div className={`qr-item${parent1Scanned ? " scanned" : ""}`}>
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <div className="qr-wrapper">
                  <QRCode value={qrValueParent1} size={200} />
                  {parent1Scanned && <div className="qr-overlay"><div className="qr-status"><span className="scan-badge">✓ SCANNED</span><p className="scan-time">{parent1ScannedAt ? fmt(parent1ScannedAt) : ""}</p></div></div>}
                </div>
              </div>
              {parent2 && qrValueParent2 && (
                <div className={`qr-item${parent2Scanned ? " scanned" : ""}`}>
                  <p className="qr-parent-label">{parent2}</p>
                  <div className="qr-wrapper">
                    <QRCode value={qrValueParent2} size={200} />
                    {parent2Scanned && <div className="qr-overlay"><div className="qr-status"><span className="scan-badge">✓ SCANNED</span><p className="scan-time">{parent2ScannedAt ? fmt(parent2ScannedAt) : ""}</p></div></div>}
                  </div>
                </div>
              )}
            </div>
            <p className="qr-text">Show {parent2 ? "these QR codes" : "this QR code"} during graduation. Do not share with others as they are one-time use only.</p>
            {emailSent ? <p className="email-sent-message">✓ QR codes sent to {email}</p> : (
              <button onClick={handleSendEmail} disabled={loading} className="send-email-btn">{loading ? "Sending…" : "Send QR Codes to Email"}</button>
            )}
            <button onClick={handleBackToSummary} className="back-btn">← Back to Summary</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — root router
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState("login"); // "login" | "student" | "admin"
  const [studentInfo, setStudentInfo] = useState(null);

  // QR scan — bypass login entirely
  const scanParent = new URLSearchParams(window.location.search).get("parent");
  if (scanParent) return <ScanPage parentName={decodeURIComponent(scanParent)} />;

  if (page === "login") return (
    <LoginPage
      onStudentLogin={(info) => { setStudentInfo(info); setPage("student"); }}
      onAdminLogin={() => setPage("admin")}
    />
  );
  if (page === "admin")   return <AdminPage   onLogout={() => setPage("login")} />;
  if (page === "student") return <StudentPage studentInfo={studentInfo} onLogout={() => { setStudentInfo(null); setPage("login"); }} />;
  return null;
}