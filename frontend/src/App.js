import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import "./App.css";
import "./RegistrationsPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "https://grad-reservation-backend.vercel.app";

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";

// ─── Scan Page ────────────────────────────────────────────────────────────────
function ScanPage({ parentName }) {
  const [status, setStatus]       = useState("loading");
  const [message, setMessage]     = useState("");
  const [scannedAt, setScannedAt] = useState(null);

  useEffect(() => {
    const scanQr = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/scan-qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentName }),
        });
        const data = await response.json();
        if (!response.ok)  { setStatus("error");    setMessage(data.error || "Failed to validate QR code."); return; }
        if (data.inactive) { setStatus("inactive"); setScannedAt(data.scannedAt); setMessage("This QR code has already been used."); return; }
        if (data.success)  { setStatus("success");  setMessage("Entry approved. Welcome to the LCC Graduation Ceremony!"); return; }
        setStatus("error"); setMessage(data.error || "Unexpected response from server.");
      } catch {
        setStatus("error");
        setMessage("Connection error. Please show this QR code to the registration desk.");
      }
    };
    scanQr();
  }, [parentName]);

  const config = {
    loading:  { icon: "○", color: "#888899", label: "Checking…" },
    success:  { icon: "✓", color: "#22c55e", label: "Entry Approved" },
    inactive: { icon: "⚠", color: "#f59e0b", label: "Already Used" },
    error:    { icon: "✕", color: "#ef4444", label: "Invalid QR Code" },
  }[status];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "#1a1a22", border: "1px solid #2a2a35", borderRadius: "20px", padding: "48px 36px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: `${config.color}18`, border: `2px solid ${config.color}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 36, color: config.color }}>
          {config.icon}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: 12 }}>
          LCC Graduation Ceremony
        </p>
        <h1 style={{ fontSize: 28, color: "#f0f0f8", marginBottom: 14, lineHeight: 1.2 }}>
          {config.label}
        </h1>
        <p style={{ fontSize: 15, color: "#888899", lineHeight: 1.6, marginBottom: status === "loading" ? 0 : 32 }}>
          {status === "loading" ? "Validating your QR code…" : message}
        </p>
        {(status === "success" || status === "inactive") && (
          <div style={{ background: "#12121a", border: "1px solid #22222e", borderRadius: 12, padding: 20, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>Guest</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#c8c8de" }}>{parentName}</span>
            </div>
            {status === "inactive" && scannedAt && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1e1e28" }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#44445a" }}>First scanned</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#c8c8de" }}>{fmt(scannedAt)}</span>
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

// ─── Registrations Page ───────────────────────────────────────────────────────
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
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, scannedRes, unscannedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/registrations?filter=all`),
        fetch(`${API_BASE_URL}/api/registrations?filter=scanned`),
        fetch(`${API_BASE_URL}/api/registrations?filter=unscanned`),
      ]);
      if (!allRes.ok) throw new Error("Failed to fetch registrations.");
      const [allData, scannedData, unscannedData] = await Promise.all([
        allRes.json(), scannedRes.json(), unscannedRes.json(),
      ]);
      setRows(allData.data || []);
      setCounts({ all: allData.total || 0, scanned: scannedData.total || 0, unscanned: unscannedData.total || 0 });
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
      return (
        (r.student_name   || "").toLowerCase().includes(q) ||
        (r.student_number || "").toLowerCase().includes(q) ||
        (r.parent_name    || "").toLowerCase().includes(q) ||
        (r.course         || "").toLowerCase().includes(q)
      );
    });

  const exportToExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("Excel export is still loading, please try again in a moment."); return; }
    const exportRows = visible.map((r) => ({
      "Student Name":   r.student_name,
      "Student Number": r.student_number,
      "Course":         r.course,
      "Email":          r.email,
      "Contact Number": r.contact_number,
      "Parent Name":    r.parent_name,
      "Slot":           r.parent_slot,
      "Status":         r.scanned ? "Scanned" : "Not Yet Scanned",
      "Scanned At":     r.scanned ? fmt(r.scanned_at) : "",
      "Registered At":  fmt(r.registered_at),
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    const sheetName = filter === "scanned" ? "Scanned" : filter === "unscanned" ? "Not Yet Scanned" : "All Registrations";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `lcc-graduation-${filter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs = [
    { key: "all",       label: "All",             count: counts.all       },
    { key: "unscanned", label: "Not Yet Scanned",  count: counts.unscanned },
    { key: "scanned",   label: "Already Scanned",  count: counts.scanned   },
  ];

  return (
    <div className="reg-page">
      <div className="reg-inner">
        <div className="reg-header">
          <h1 className="reg-title">🎓 Graduation Registrations</h1>
          <button className="reg-back-btn" onClick={onBack}>← Back</button>
        </div>
        <div className="reg-tabs">
          {tabs.map(({ key, label, count }) => (
            <button key={key} className={`reg-tab${filter === key ? ` active-${key}` : ""}`} onClick={() => setFilter(key)}>
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
              <thead>
                <tr>{["Student Name","Student No.","Course","Parent Name","Slot","Status","Scanned At","Registered At"].map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
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

// ─── Main App ─────────────────────────────────────────────────────────────────
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
  const [parent1Scanned, setParent1Scanned]         = useState(false);
  const [parent2Scanned, setParent2Scanned]         = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt]     = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt]     = useState(null);
  const [isApiConnected, setIsApiConnected]         = useState(false);
  const [showRegistrations, setShowRegistrations]   = useState(false);

  
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);

  useEffect(() => {
    if (!submitted) return;
    const checkScans = async () => {
      try {
        const r1 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentName: parent1 }),
        });
        if (r1.ok) { const d1 = await r1.json(); setParent1Scanned(d1.scanned); setParent1ScannedAt(d1.scannedAt); }
        if (parent2) {
          const r2 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentName: parent2 }),
          });
          if (r2.ok) { const d2 = await r2.json(); setParent2Scanned(d2.scanned); setParent2ScannedAt(d2.scannedAt); }
        }
      } catch (err) { console.error("Error checking QR scans:", err); }
    };
    checkScans();
    const interval = setInterval(checkScans, 5000);
    return () => clearInterval(interval);
  }, [submitted, parent1, parent2]);

  // ── Conditional renders — after ALL hooks ─────────────────────────────────
  const urlParams  = new URLSearchParams(window.location.search);
  const scanParent = urlParams.get("parent");
  if (scanParent) return <ScanPage parentName={decodeURIComponent(scanParent)} />;
  if (showRegistrations) return <RegistrationsPage onBack={() => setShowRegistrations(false)} />;

  const qrValueParent1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrValueParent2 = parent2 ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent2)}` : null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isApiConnected) { alert("Backend server is not connected."); return; }
    try {
      const checkRes = await fetch(`${API_BASE_URL}/api/check-student-number`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber }),
      });
      if (!checkRes.ok) { setStudentNumberError("Server error. Please try again."); return; }
      const { exists } = await checkRes.json();
      if (exists) { setStudentNumberError("This student number is already registered."); return; }
      setStudentNumberError("");
      const qr1DataUrl = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2DataUrl = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;
      const saveRes = await fetch(`${API_BASE_URL}/api/save-registration`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, studentNumber, course, email, contactNumber, parent1, parent2, qrCodeParent1: qr1DataUrl, qrCodeParent2: qr2DataUrl }),
      });
      if (!saveRes.ok) { const err = await saveRes.json(); throw new Error(err.error || "Failed to save registration."); }
      setSubmitted(true);
    } catch (err) { alert("Registration failed: " + err.message); }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const qr1DataUrl = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2DataUrl = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;
      const res = await fetch(`${API_BASE_URL}/api/send-qr-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, email, parent1, parent2, qrDataParent1: qr1DataUrl, qrDataParent2: qr2DataUrl }),
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
          <h1 className="form-title" style={{ margin: 0 }}>79th Commencement Exercises</h1>
          <h1 className="form-title" style={{ margin: 0 }}>2025-2026</h1>
          <button onClick={() => setShowRegistrations(true)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            View Registrations
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
              onChange={(e) => { setStudentNumber(e.target.value.replace(/[^0-9]/g, "")); setStudentNumberError(""); }}
              className="form-input" required />
            {studentNumberError && <p className="error-message">{studentNumberError}</p>}

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

            <button type="submit" className="submit-btn" disabled={!isApiConnected}>Generate QR Code</button>
          </form>
        ) : (
          <div className="qr-section">
            <p className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</p>
            <div className="qr-container">
              <div className={`qr-item ${parent1Scanned ? "scanned" : ""}`}>
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
              {parent2 && (
                <div className={`qr-item ${parent2Scanned ? "scanned" : ""}`}>
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

            <button onClick={() => { setSubmitted(false); setEmailSent(false); }} className="back-btn">Back to Form</button>
          </div>
        )}
      </div>
    </div>
  );
}