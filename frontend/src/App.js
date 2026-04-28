import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import "./App.css";
import "./RegistrationsPage.css";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://grad-reservation-backend.vercel.app";

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

const fmt = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" }); }
  catch { return String(iso); }
};

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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentName }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok)       { setStatus("error");    setMessage(d.error || "Failed to validate QR code."); }
        else if (d.inactive) { setStatus("inactive"); setScannedAt(d.scannedAt); setMessage("This QR code has already been used."); }
        else if (d.success)  { setStatus("success");  setMessage("Entry approved. Welcome to the LCC Graduation Ceremony!"); }
        else                 { setStatus("error");    setMessage(d.error || "Unexpected response."); }
      })
      .catch(() => { setStatus("error"); setMessage("Connection error. Please show this QR code to the registration desk."); });
  }, [parentName]);

  const CONFIGS = {
    loading:  { icon: "○", color: "#888899", label: "Checking…"       },
    success:  { icon: "✓", color: "#22c55e", label: "Entry Approved"   },
    inactive: { icon: "⚠", color: "#f59e0b", label: "Already Used"     },
    error:    { icon: "✕", color: "#ef4444", label: "Invalid QR Code"  },
  };
  const cfg = CONFIGS[status] || CONFIGS.error;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: "20px", padding: "48px 36px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: cfg.color + "18", border: "2px solid " + cfg.color + "40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 36, color: cfg.color }}>
          {cfg.icon}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>
          LCC Graduation Ceremony
        </p>
        <h1 style={{ fontSize: 28, color: "#f0f0f8", marginBottom: 14, lineHeight: 1.2 }}>
          {cfg.label}
        </h1>
        <p style={{ fontSize: 15, color: "#888899", lineHeight: 1.6, marginBottom: 32 }}>
          {message}
        </p>
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
        <p style={{ marginTop: 28, fontSize: 12, color: "#33334a" }}>
          {fmt(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PasswordGate — shown before RegistrationsPage to protect admin access
// ─────────────────────────────────────────────────────────────────────────────
function PasswordGate({ onSuccess, onCancel }) {
  const [input, setInput]       = useState("");
  const [show, setShow]         = useState(false);
  const [error, setError]       = useState("");
  const [shaking, setShaking]   = useState(false);

  const attempt = (e) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError("Incorrect password. Please try again.");
      setShaking(true);
      setInput("");
      setTimeout(() => setShaking(false), 600);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-8px); }
          40%,80%  { transform: translateX(8px); }
        }
        .gate-shake { animation: shake 0.5s ease; }
        .gate-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .gate-btn:hover:not(:disabled) { background: #4f46e5; }
        .gate-cancel:hover { color: #888899; }
      `}</style>

      <div className={shaking ? "gate-shake" : ""} style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: 20, padding: "48px 36px", maxWidth: 380, width: "100%", textAlign: "center" }}>

        {/* Lock icon */}
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(99,102,241,0.1)", border: "2px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 28 }}>
          🔒
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 10 }}>
          Admin Access
        </p>
        <h2 style={{ fontSize: 24, color: "#f0f0f8", marginBottom: 8, fontWeight: 700 }}>
          View Registrations
        </h2>
        <p style={{ fontSize: 14, color: "#666677", marginBottom: 28 }}>
          Enter the admin password to continue.
        </p>

        <form onSubmit={attempt}>
          {/* Password input with show/hide toggle */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              className="gate-input"
              type={show ? "text" : "password"}
              placeholder="Enter password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(""); }}
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", background: "#12121a", border: "1px solid #2a2a35", borderRadius: 10, padding: "12px 44px 12px 14px", color: "#e0e0f0", fontSize: 15 }}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#555566", fontSize: 16, padding: 0, lineHeight: 1 }}
              tabIndex={-1}
            >
              {show ? "🙈" : "👁"}
            </button>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12, textAlign: "left" }}>
              {error}
            </p>
          )}

          <button
            className="gate-btn"
            type="submit"
            disabled={!input}
            style={{ width: "100%", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: input ? "pointer" : "not-allowed", opacity: input ? 1 : 0.5, transition: "background 0.15s" }}
          >
            Unlock
          </button>
        </form>

        <button
          className="gate-cancel"
          onClick={onCancel}
          style={{ marginTop: 16, background: "none", border: "none", color: "#44445a", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RegistrationsPage — shown when "View Registrations" is clicked
// ─────────────────────────────────────────────────────────────────────────────
function RegistrationsPage({ onBack }) {
  const [filter, setFilter]           = useState("all");
  const [rows, setRows]               = useState([]);
  const [counts, setCounts]           = useState({ all: 0, scanned: 0, unscanned: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    if (window.XLSX) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visible = rows
    .filter((r) => filter === "scanned" ? r.scanned : filter === "unscanned" ? !r.scanned : true)
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return ["student_name", "student_number", "parent_name", "course"]
        .some((k) => (r[k] || "").toLowerCase().includes(q));
    });

  const exportToExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("Excel export is still loading, please try again."); return; }
    const ws = XLSX.utils.json_to_sheet(visible.map((r) => ({
      "Student Name":   r.student_name   || "",
      "Student Number": r.student_number || "",
      "Course":         r.course         || "",
      "Email":          r.email          || "",
      "Contact Number": r.contact_number || "",
      "Parent Name":    r.parent_name    || "",
      "Slot":           r.parent_slot    || "",
      "Status":         r.scanned ? "Scanned" : "Not Yet Scanned",
      "Scanned At":     r.scanned ? fmt(r.scanned_at) : "",
      "Registered At":  fmt(r.registered_at),
    })));
    ws["!cols"] = [24,16,10,28,16,24,10,20,22,22].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,
      filter === "scanned" ? "Scanned" : filter === "unscanned" ? "Not Yet Scanned" : "All Registrations"
    );
    XLSX.writeFile(wb, `lcc-graduation-${filter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const TABS = [
    { key: "all",       label: "All",             count: counts.all       },
    { key: "unscanned", label: "Not Yet Scanned",  count: counts.unscanned },
    { key: "scanned",   label: "Already Scanned",  count: counts.scanned   },
  ];
  const COLS = ["Student Name","Student No.","Course","Parent Name","Slot","Status","Scanned At","Registered At"];

  return (
    <div className="reg-page">
      <div className="reg-inner">
        <div className="reg-header">
          <h1 className="reg-title">🎓 Graduation Registrations</h1>
          <button className="reg-back-btn" onClick={onBack}>← Back</button>
        </div>
        <div className="reg-tabs">
          {TABS.map(({ key, label, count }) => (
            <button key={key} className={`reg-tab${filter === key ? " active-" + key : ""}`} onClick={() => setFilter(key)}>
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="reg-toolbar">
          <input className="reg-search" placeholder="Search by student, parent, course…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="reg-refresh-btn" onClick={fetchData} disabled={loading}>{loading ? "…" : "↻ Refresh"}</button>
          <button className="reg-export-btn" onClick={exportToExcel} disabled={visible.length === 0}>↓ Export to Excel ({visible.length})</button>
        </div>
        {error   ? <p className="reg-error">Error: {error}</p>
        : loading ? <p className="reg-state">Loading…</p>
        : visible.length === 0 ? <p className="reg-state">No records found.</p>
        : (
          <div className="reg-table-wrap">
            <table className="reg-table">
              <thead><tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={`${r.student_number}-${r.parent_slot}`}>
                    <td>{r.student_name}</td>
                    <td>{r.student_number}</td>
                    <td>{r.course}</td>
                    <td>{r.parent_name}</td>
                    <td><span className="slot-label">{r.parent_slot}</span></td>
                    <td><span className={r.scanned ? "badge-scanned" : "badge-pending"}>{r.scanned ? "✓ Scanned" : "Pending"}</span></td>
                    <td>{r.scanned ? fmt(r.scanned_at) : "—"}</td>
                    <td>{fmt(r.registered_at)}</td>
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — main entry, all hooks declared first, conditional renders last
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [studentName, setStudentName]               = useState("");
  const [studentNumber, setStudentNumber]           = useState("");
  const [course, setCourse]                         = useState("");
  const [email, setEmail]                           = useState("");
  const [contactNumber, setContactNumber]           = useState("");
  const [parent1, setParent1]                       = useState("");
  const [parent2, setParent2]                       = useState("");
  const [submitted, setSubmitted]                   = useState(false);
  const [loading, setLoading]                       = useState(false);
  const [emailSent, setEmailSent]                   = useState(false);
  const [studentNumberError, setStudentNumberError] = useState("");
  const [studentNumberStatus, setStudentNumberStatus] = useState("idle"); // idle | checking | available | taken
  const [parent1Scanned, setParent1Scanned]         = useState(false);
  const [parent2Scanned, setParent2Scanned]         = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt]     = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt]     = useState(null);
  const [isApiConnected, setIsApiConnected]         = useState(false);
  const [showGate, setShowGate]                     = useState(false);
  const [showRegistrations, setShowRegistrations]   = useState(false);

  // ── scanParent derived from URL — stable, not a hook ─────────────────────
  const scanParent = new URLSearchParams(window.location.search).get("parent");

  // ── ALL hooks before any conditional return ───────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);


  // ── Debounced real-time student number duplicate check ────────────────────
  useEffect(() => {
    if (!studentNumber || studentNumber.length < 3) {
      setStudentNumberStatus("idle");
      setStudentNumberError("");
      return;
    }
    setStudentNumberStatus("checking");
    setStudentNumberError("");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/check-student-number`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentNumber }),
        });
        if (!res.ok) { setStudentNumberStatus("idle"); return; }
        const { exists } = await res.json();
        if (exists) {
          setStudentNumberStatus("taken");
          setStudentNumberError("This student number is already registered.");
        } else {
          setStudentNumberStatus("available");
          setStudentNumberError("");
        }
      } catch {
        setStudentNumberStatus("idle");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [studentNumber]);

  useEffect(() => {
    if (!submitted) return;
    const check = async () => {
      try {
        const r1 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentName: parent1 }),
        });
        if (r1.ok) { const d = await r1.json(); setParent1Scanned(d.scanned); setParent1ScannedAt(d.scannedAt); }
        if (parent2) {
          const r2 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentName: parent2 }),
          });
          if (r2.ok) { const d = await r2.json(); setParent2Scanned(d.scanned); setParent2ScannedAt(d.scannedAt); }
        }
      } catch (e) { console.error("QR scan check error:", e); }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [submitted, parent1, parent2]);

  // ── Conditional renders — safely after all hooks ──────────────────────────
  if (scanParent)        return <ScanPage parentName={decodeURIComponent(scanParent)} />;
  if (showGate)          return <PasswordGate onSuccess={() => { setShowGate(false); setShowRegistrations(true); }} onCancel={() => setShowGate(false)} />;
  if (showRegistrations) return <RegistrationsPage onBack={() => { setShowRegistrations(false); }} />;

  // ── Derived values ────────────────────────────────────────────────────────
  const qrValueParent1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrValueParent2 = parent2 ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent2)}` : null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isApiConnected) { alert("Backend server is not connected."); return; }
    if (studentNumberStatus === "taken") { setStudentNumberError("This student number is already registered."); return; }
    try {
      const checkRes = await fetch(`${API_BASE_URL}/api/check-student-number`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber }),
      });
      if (!checkRes.ok) { setStudentNumberError("Server error. Please try again."); return; }
      const { exists } = await checkRes.json();
      if (exists) { setStudentNumberError("This student number is already registered."); return; }
      setStudentNumberError("");

      const qr1 = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2 = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;

      const saveRes = await fetch(`${API_BASE_URL}/api/save-registration`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, studentNumber, course, email, contactNumber, parent1, parent2, qrCodeParent1: qr1, qrCodeParent2: qr2 }),
      });
      const saveData = await saveRes.json();
      if (saveRes.status === 409 || saveData.duplicate) {
        setStudentNumberStatus("taken");
        setStudentNumberError("This student number is already registered.");
        return;
      }
      if (!saveRes.ok) { throw new Error(saveData.error || "Failed to save."); }
      setSubmitted(true);
    } catch (err) { alert("Registration failed: " + err.message); }
  };

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <div className="form-card">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          <h1 className="form-title" style={{ margin: 0 }}>LCC Commencement Exercises 2025-2026</h1>
          <button onClick={() => setShowGate(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🔒 View Registrations
          </button>
        </div>

        <p className="form-description">
          Fill out the form below to reserve your spot for the LCC graduation ceremony.
          You can reserve up to 2 spots only. After submitting, a QR code will be generated
          for each reserved spot. Show the QR code(s) during graduation to gain entry.
          The QR code(s) will also be sent to your email for safekeeping.
        </p>

        {!isApiConnected && (
          <div className="warning-message">⚠️ Connecting to server… Please wait or check your connection.</div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="form">
            <label className="form-label">Student Name <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Enter your full name" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="form-input" required />

            <label className="form-label">Student Number <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Enter your student number" value={studentNumber}
              onChange={(e) => { setStudentNumber(e.target.value.replace(/[^0-9]/g, "")); }}
              className="form-input"
              style={{
                borderColor:
                  studentNumberStatus === "taken"     ? "#ef4444" :
                  studentNumberStatus === "available" ? "#22c55e" :
                  studentNumberStatus === "checking"  ? "#6366f1" :
                  undefined,
                transition: "border-color 0.2s",
              }}
              required />
            {studentNumber.length >= 3 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 13, minHeight: 20 }}>
                {studentNumberStatus === "checking" && (
                  <><span style={{ color: "#6366f1" }}>⟳</span><span style={{ color: "#6366f1" }}>Checking availability…</span></>
                )}
                {studentNumberStatus === "available" && (
                  <><span style={{ color: "#22c55e" }}>✓</span><span style={{ color: "#22c55e" }}>Student number is available</span></>
                )}
                {studentNumberStatus === "taken" && (
                  <><span style={{ color: "#ef4444" }}>✕</span><span style={{ color: "#ef4444" }}>This student number is already registered</span></>
                )}
              </div>
            )}

            <label className="form-label">Department <span className="required-asterisk">*</span></label>
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="form-input" required>
              <option value="">Select a department</option>
              <option value="CELA">CELA</option>
              <option value="CBA">CBA</option>
              <option value="CCJE">CCJE</option>
              <option value="CON">CON</option>
              <option value="CITHM">CITHM</option>
              <option value="CCTE">CCTE</option>
            </select>

            <label className="form-label">Email <span className="required-asterisk">*</span></label>
            <input type="email" placeholder="your.email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />

            <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
            <input type="tel" placeholder="09123456789" value={contactNumber} onChange={(e) => setContactNumber(e.target.value.replace(/[^0-9]/g, ""))} className="form-input" required />

            <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Parent/Guardian 1 full name" value={parent1} onChange={(e) => setParent1(e.target.value)} className="form-input" required />

            <label className="form-label">Parent 2 Name (Optional)</label>
            <input type="text" placeholder="Parent/Guardian 2 full name" value={parent2} onChange={(e) => setParent2(e.target.value)} className="form-input" />

            <button type="submit" className="submit-btn" disabled={!isApiConnected || studentNumberStatus === "taken" || studentNumberStatus === "checking"}>Generate QR Code</button>
          </form>
        ) : (
          <div className="qr-section">
            <p className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</p>
            <div className="qr-container">

              <div className={`qr-item${parent1Scanned ? " scanned" : ""}`}>
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <div className="qr-wrapper">
                  <QRCode value={qrValueParent1} size={200} />
                  {parent1Scanned && (
                    <div className="qr-overlay">
                      <div className="qr-status">
                        <span className="scan-badge">✓ SCANNED</span>
                        <p className="scan-time">{parent1ScannedAt ? fmt(parent1ScannedAt) : ""}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {parent2 && qrValueParent2 && (
                <div className={`qr-item${parent2Scanned ? " scanned" : ""}`}>
                  <p className="qr-parent-label">{parent2}</p>
                  <div className="qr-wrapper">
                    <QRCode value={qrValueParent2} size={200} />
                    {parent2Scanned && (
                      <div className="qr-overlay">
                        <div className="qr-status">
                          <span className="scan-badge">✓ SCANNED</span>
                          <p className="scan-time">{parent2ScannedAt ? fmt(parent2ScannedAt) : ""}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="qr-text">
              Show {parent2 ? "these QR codes" : "this QR code"} during graduation.
              Do not share these with others as they are one-time use only.
            </p>

            {emailSent ? (
              <p className="email-sent-message">✓ QR codes sent to {email}</p>
            ) : (
              <button onClick={handleSendEmail} disabled={loading} className="send-email-btn">
                {loading ? "Sending…" : "Send QR Codes to Email"}
              </button>
            )}

            <button onClick={() => { setSubmitted(false); setEmailSent(false); }} className="back-btn">
              Back to Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}