import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import "./App.css";
import "./RegistrationsPage.css";

const API_BASE_URL    = process.env.REACT_APP_API_URL      || "https://grad-reservation-backend.vercel.app";
// YYYY-MM-DD format e.g. "2025-06-15" — set via REACT_APP_EVENT_DATE env var
const EVENT_DATE      = process.env.REACT_APP_EVENT_DATE || null;

function isBeforeEventDate() {
  if (!EVENT_DATE) return true;
  const now   = new Date();
  const event = new Date(EVENT_DATE + "T00:00:00+08:00");
  return now < event;
}

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
        if (!ok) {
          setStatus("error");
          setMessage(d.error || "Failed to validate.");
        } else if (d.inactive) {
          // One-time use enforced — event has already passed
          setStatus("inactive");
          setScannedAt(d.scannedAt);
          setMessage("This QR code has already been used and the event has passed.");
        } else if (d.success && d.rescan) {
          // Valid re-scan before event date
          setStatus("rescan");
          setScannedAt(d.scannedAt);
          setMessage("QR code verified. This guest has been checked in again.");
        } else if (d.success && d.beforeEvent) {
          // First-time scan before event date — test scan
          setStatus("test");
          setMessage("QR code is valid. This is a test scan — the event has not started yet.");
        } else if (d.success) {
          // First-time scan on/after event date
          setStatus("success");
          setMessage("Entry approved. Welcome to the LCC Graduation Ceremony!");
        } else {
          setStatus("error");
          setMessage(d.error || "Unexpected response.");
        }
      })
      .catch(() => { setStatus("error"); setMessage("Connection error. Please show this QR code to the registration desk."); });
  }, [parentName]);

  const CFG = {
    loading:  { icon: "○", color: "#888899", label: "Checking…"          },
    success:  { icon: "✓", color: "#22c55e", label: "Entry Approved"     },
    test:     { icon: "⚡", color: "#06b6d4", label: "Test Scan"          },
    rescan:   { icon: "↻", color: "#6366f1", label: "Re-entry Verified"  },
    inactive: { icon: "⚠", color: "#f59e0b", label: "Already Used"       },
    error:    { icon: "✕", color: "#ef4444", label: "Invalid QR Code"    },
  };
  const cfg = CFG[status] || CFG.error;

  return (
    <Card>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: cfg.color + "18", border: "2px solid " + cfg.color + "40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 36, color: cfg.color }}>{cfg.icon}</div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>LCC Graduation Ceremony</p>
      <h1 style={{ fontSize: 28, color: "#f0f0f8", marginBottom: 14, lineHeight: 1.2 }}>{cfg.label}</h1>
      <p style={{ fontSize: 15, color: "#888899", lineHeight: 1.6, marginBottom: 32 }}>{message}</p>
      {(status === "success" || status === "test" || status === "rescan" || status === "inactive") && (
        <div style={{ background: "#12121a", border: "1px solid #22222e", borderRadius: 12, padding: 20, textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>Guest</span>
            <span style={{ fontSize: 14, color: "#c8c8de" }}>{parentName}</span>
          </div>
          {(status === "inactive" || status === "rescan") && scannedAt && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1e1e28" }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>
                {status === "rescan" ? "Checked in at" : "First scanned"}
              </span>
              <span style={{ fontSize: 14, color: "#c8c8de" }}>{fmt(scannedAt)}</span>
            </div>
          )}
        </div>
      )}
      {EVENT_DATE && (
        <p style={{ marginTop: 12, fontSize: 12, color: "#33334a" }}>
          {isBeforeEventDate()
            ? `QR valid for multiple entries until ${new Date(EVENT_DATE + "T00:00:00+08:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`
            : "One-time use enforced — event has passed"}
        </p>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: "#33334a" }}>{fmt(new Date().toISOString())}</p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage — role selector + credential entry
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({ onStudentLogin }) {
  const [role, setRole]       = useState(null);       // null | "student"
  const [input, setInput]     = useState("");
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
      onStudentLogin({
        studentNumber:   input,
        studentName:     data.student_name    || "",
        course:          data.course          || "",
        email:           data.email           || "",
        contactNumber:   data.contact_number  || "",
        parent1:         data.parent1_name    || "",
        parent2:         data.parent2_name    || "",
        hasRegistration: !!(data.has_registration),
      });
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
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 8 }}>79th Commencement Exercises 2026</p>
          <h1 style={{ fontSize: 26, color: "#f0f0f8", margin: 0, fontWeight: 700 }}>
            {role === null ? "Welcome" : "Student Login"}
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
          </div>
        )}

        {/* Credential form */}
        {role !== null && (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#888899", marginBottom: 8, textAlign: "left" }}>
              "Student Number"
            </label>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                className="auth-input"
                type="text"
                placeholder="Enter your student number"
                value={input}
                onChange={(e) => { setInput(role === "student" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value); setError(""); }}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", background: "#12121a", border: "1px solid #2a2a35", borderRadius: 10, padding: "12px 14px", color: "#e0e0f0", fontSize: 15 }}
              />

            </div>

            {error && <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 12, textAlign: "left" }}>{error}</p>}

            <button className="submit-login" type="submit" disabled={!input.trim() || loading}
              style={{ width: "100%", background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: (!input.trim() || loading) ? "not-allowed" : "pointer", opacity: (!input.trim() || loading) ? 0.5 : 1, transition: "background 0.15s" }}>
              {loading ? "Checking…" : "Continue"}
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
// StudentPage — registration form + QR display + edit existing registration
// ─────────────────────────────────────────────────────────────────────────────
function StudentPage({ studentInfo, onLogout }) {
  const initialStudentNumber = studentInfo?.studentNumber || "";
  const hasRegistration      = studentInfo?.hasRegistration || false;

  // ── view | "form" (new registration) | "edit" (editing existing) | "qr" ──
  const [mode, setMode]                 = useState(hasRegistration ? "view" : "form");
  const [studentName]                   = useState(studentInfo?.studentName    || "");
  const [studentNumber]                 = useState(initialStudentNumber);
  const [course]                        = useState(studentInfo?.course         || "");
  const [email, setEmail]               = useState(studentInfo?.email          || "");
  const [contactNumber, setContactNumber] = useState(studentInfo?.contactNumber || "");
  const [parent1, setParent1]           = useState(studentInfo?.parent1        || "");
  const [parent2, setParent2]           = useState(studentInfo?.parent2        || "");
  const [loading, setLoading]           = useState(false);
  const [emailSent, setEmailSent]       = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [parent1Scanned, setParent1Scanned]     = useState(false);
  const [parent2Scanned, setParent2Scanned]     = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt] = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt] = useState(null);

  // Edit mode — working copies so cancel restores originals
  const [editParent1, setEditParent1] = useState(studentInfo?.parent1 || "");
  const [editParent2, setEditParent2] = useState(studentInfo?.parent2 || "");
  const [editEmail, setEditEmail]     = useState(studentInfo?.email   || "");
  const [editContact, setEditContact] = useState(studentInfo?.contactNumber || "");

  const qrValueParent1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrValueParent2 = parent2 ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent2)}` : null;

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);

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
        body: JSON.stringify({ studentName, studentNumber, course, email, contactNumber, parent1, parent2, qrCodeParent1: qr1, qrCodeParent2: qr2 }),
      });
      const saveData = await saveRes.json();
      if (saveRes.status === 409 || saveData.duplicate) { alert("This student number is already registered."); return; }
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save.");
      setMode("qr");
    } catch (err) { alert("Registration failed: " + err.message); }
    finally { setLoading(false); }
  };

  // ── Edit save — delete old + insert new ──────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editParent1.trim()) { alert("Parent 1 name is required."); return; }
    if (!window.confirm("This will delete the old QR codes and generate new ones.\n\nContinue?")) return;
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
          email:         editEmail,
          contactNumber: editContact,
          parent1:       editParent1,
          parent2:       editParent2,
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
      setParent1Scanned(false); setParent1ScannedAt(null);
      setParent2Scanned(false); setParent2ScannedAt(null);
      setEmailSent(false);
      setMode("qr");
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

  // ── Shared locked field style ─────────────────────────────────────────────
  const lockedStyle = { background: "#9595a3", color: "#000000", cursor: "not-allowed", borderColor: "#1e1e28" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <div className="form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          <h1 className="form-title" style={{ margin: 0 }}>LCC 79th Commencement Exercises 2026</h1>
          <button onClick={onLogout} style={{ background: "#ff0000", border: "1px solid #2a2a35", color: "#000000", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Logout</button>
        </div>

        {!isApiConnected && <div className="warning-message">⚠️ Connecting to server… Please wait.</div>}

        {/* ── VIEW mode: existing registration summary ── */}
        {mode === "view" && (
          <div>
            <p className="form-description">You have already registered. Review your details below.</p>

            {/* Student info block */}
            <div style={{ background: "#ffffff", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000000", marginBottom: 12 }}>Student Information</p>
              {[["Name", studentName], ["Student Number", studentNumber], ["Department", course], ["Email", email || "—"], ["Contact", contactNumber || "—"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                  <span style={{ fontSize: 13, color: "#000000" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#000000", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Parent info block */}
            <div style={{ background: "#ffffff", border: "1px solid #1e1e28", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#000000", marginBottom: 12 }}>Registered Parents / Guardians</p>
              {[["Parent 1", parent1], ["Parent 2", parent2 || "—"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1a1a22" }}>
                  <span style={{ fontSize: 13, color: "#000000" }}>{label}</span>
                  <span style={{ fontSize: 13, color: val === "—" ? "#000000" : "#000000", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setMode("qr")}
                style={{ flex: 1, background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                View QR Codes
              </button>
              <button onClick={() => { setEditParent1(parent1); setEditParent2(parent2); setEditEmail(email); setEditContact(contactNumber); setMode("edit"); }}
                style={{ flex: 1, background: "#1ac825", color: "#000000", border: "1px solid rgba(0, 0, 0, 0.4)", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ✏️ Edit Parents
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT mode ── */}
        {mode === "edit" && (
          <div>
            <p className="form-description">Update your parent/guardian details. New QR codes will be generated and old ones will be invalidated.</p>

            <div style={{ background: "#ffffff", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#f59e0b" }}>
              ⚠️ Editing will delete the current QR codes. Make sure any previously shared QR codes are discarded.
            </div>

            <form onSubmit={handleEditSave} className="form">
              <label className="form-label">Student Name</label>
              <input type="text" value={studentName || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Student Number</label>
              <input type="text" value={studentNumber || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Department</label>
              <input type="text" value={course || "—"} readOnly className="form-input" style={lockedStyle} tabIndex={-1} />

              <label className="form-label">Email <span className="required-asterisk">*</span></label>
              <input type="email" placeholder="your.email@example.com" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="form-input" required />

              <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
              <input type="tel" placeholder="09123456789" value={editContact} onChange={e => setEditContact(e.target.value.replace(/[^0-9]/g, ""))} className="form-input" required />

              <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
              <input type="text" placeholder="Parent/Guardian 1 full name" value={editParent1} onChange={e => setEditParent1(e.target.value)} className="form-input" required />

              <label className="form-label">Parent 2 Name (Optional)</label>
              <input type="text" placeholder="Parent/Guardian 2 full name" value={editParent2} onChange={e => setEditParent2(e.target.value)} className="form-input" />

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setMode("view")}
                  style={{ flex: 1, background: "transparent", border: "1px solid #2a2a35", color: "#888899", borderRadius: 8, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading || !editParent1.trim()}
                  style={{ flex: 2, background: "#0bf52a", color: "#111", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: (!loading && editParent1.trim()) ? "pointer" : "not-allowed", opacity: (!loading && editParent1.trim()) ? 1 : 0.5 }}>
                  {loading ? "Saving…" : "Save & Regenerate QR Codes"}
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

              <label className="form-label">Department</label>
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
              <div className={`qr-item${parent1Scanned && !isBeforeEventDate() ? " scanned" : ""}`}>
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <div className="qr-wrapper">
                  <QRCode value={qrValueParent1} size={200} />
                  {parent1Scanned && !isBeforeEventDate() && <div className="qr-overlay"><div className="qr-status"><span className="scan-badge">✓ SCANNED</span><p className="scan-time">{parent1ScannedAt ? fmt(parent1ScannedAt) : ""}</p></div></div>}
                </div>
              </div>
              {parent2 && qrValueParent2 && (
                <div className={`qr-item${parent2Scanned && !isBeforeEventDate() ? " scanned" : ""}`}>
                  <p className="qr-parent-label">{parent2}</p>
                  <div className="qr-wrapper">
                    <QRCode value={qrValueParent2} size={200} />
                    {parent2Scanned && !isBeforeEventDate() && <div className="qr-overlay"><div className="qr-status"><span className="scan-badge">✓ SCANNED</span><p className="scan-time">{parent2ScannedAt ? fmt(parent2ScannedAt) : ""}</p></div></div>}
                  </div>
                </div>
              )}
            </div>
            <p className="qr-text">Show {parent2 ? "these QR codes" : "this QR code"} during graduation. Do not share with others as they are one-time use only.</p>
            {emailSent ? <p className="email-sent-message">✓ QR codes sent to {email}</p> : (
              <button onClick={handleSendEmail} disabled={loading} className="send-email-btn">{loading ? "Sending…" : "Send QR Codes to Email"}</button>
            )}
            <button onClick={() => setMode("view")} className="back-btn">← Back to Summary</button>
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
  const [page, setPage]               = useState("login"); // "login" | "student"
  const [studentInfo, setStudentInfo] = useState(null);

  // QR scan — bypass login entirely
  const scanParent = new URLSearchParams(window.location.search).get("parent");
  if (scanParent) return <ScanPage parentName={decodeURIComponent(scanParent)} />;

  if (page === "login") return (
    <LoginPage
      onStudentLogin={(info) => { setStudentInfo(info); setPage("student"); }}
    />
  );
  if (page === "student") return <StudentPage studentInfo={studentInfo} onLogout={() => { setStudentInfo(null); setPage("login"); }} />;
  return null;
}