import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import "./App.css";
import QRCodeLib from "qrcode";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://grad-reservation-backend.vercel.app';

// ─── Scan Page ────────────────────────────────────────────────────────────────
// Rendered when the URL contains ?parent=... (i.e. someone scanned a QR code)
function ScanPage({ parentName }) {
  const [status, setStatus]   = useState("loading"); // "loading" | "success" | "inactive" | "error"
  const [message, setMessage] = useState("");
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

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "Failed to validate QR code.");
          return;
        }

        if (data.inactive) {
          setStatus("inactive");
          setScannedAt(data.scannedAt);
          setMessage("This QR code has already been used.");
          return;
        }

        if (data.success) {
          setStatus("success");
          setMessage("Entry approved. Welcome to the LCC Graduation Ceremony!");
          return;
        }

        setStatus("error");
        setMessage(data.error || "Unexpected response from server.");
      } catch (err) {
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
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f0f13",
      padding: "24px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: "#1a1a22",
        border: "1px solid #2a2a35",
        borderRadius: "20px",
        padding: "48px 36px",
        maxWidth: "380px",
        width: "100%",
        textAlign: "center",
        animation: "rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');
          @keyframes rise { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          @keyframes pop  { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
        `}</style>

        {/* Icon ring */}
        <div style={{
          width: "88px", height: "88px", borderRadius: "50%",
          background: `${config.color}18`,
          border: `2px solid ${config.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          fontSize: "36px", color: config.color,
          animation: "pop 0.4s 0.2s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {config.icon}
        </div>

        <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555566", marginBottom: "12px" }}>
          LCC Graduation Ceremony
        </p>

        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: "#f0f0f8", marginBottom: "14px", lineHeight: 1.2 }}>
          {config.label}
        </h1>

        <p style={{ fontSize: "15px", color: "#888899", lineHeight: 1.6, marginBottom: status === "loading" ? 0 : "32px" }}>
          {status === "loading" ? "Validating your QR code…" : message}
        </p>

        {/* Details block — shown for success/inactive */}
        {(status === "success" || status === "inactive") && (
          <div style={{
            background: "#12121a", border: "1px solid #22222e",
            borderRadius: "12px", padding: "20px", textAlign: "left",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#44445a" }}>Guest</span>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#c8c8de" }}>{parentName}</span>
            </div>
            {status === "inactive" && scannedAt && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #1e1e28" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#44445a" }}>First scanned</span>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#c8c8de" }}>
                  {new Date(scannedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timestamp footer */}
        <p style={{ marginTop: "28px", fontSize: "12px", color: "#33334a" }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: config.color, marginRight: 6, verticalAlign: "middle" }} />
          {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [studentName, setStudentName]         = useState("");
  const [studentNumber, setStudentNumber]     = useState("");
  const [course, setCourse]                   = useState("");
  const [email, setEmail]                     = useState("");
  const [contactNumber, setContactNumber]     = useState("");
  const [parent1, setParent1]                 = useState("");
  const [parent2, setParent2]                 = useState("");
  const [submitted, setSubmitted]             = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [emailSent, setEmailSent]             = useState(false);
  const [studentNumberError, setStudentNumberError] = useState("");
  const [parent1Scanned, setParent1Scanned]   = useState(false);
  const [parent2Scanned, setParent2Scanned]   = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt] = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt] = useState(null);
  const [isApiConnected, setIsApiConnected]   = useState(false);

  // ── Detect scan mode from URL (no router dependency) ──────────────────────
  const urlParams  = new URLSearchParams(window.location.search);
  const scanParent = urlParams.get("parent");
  if (scanParent) {
    return <ScanPage parentName={decodeURIComponent(scanParent)} />;
  }

  // QR values encode the BACKEND scan URL so the phone hits the API directly
  const qrValueParent1 = `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrValueParent2 = parent2
    ? `${API_BASE_URL}/scan?parent=${encodeURIComponent(parent2)}`
    : null;

  // ── Backend health check ───────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);

  // ── Poll QR scan status every 5s after submission ─────────────────────────
  useEffect(() => {
    if (!submitted) return;

    const checkScans = async () => {
      try {
        const r1 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentName: parent1 }),
        });
        if (r1.ok) {
          const d1 = await r1.json();
          setParent1Scanned(d1.scanned);
          setParent1ScannedAt(d1.scannedAt);
        }

        if (parent2) {
          const r2 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentName: parent2 }),
          });
          if (r2.ok) {
            const d2 = await r2.json();
            setParent2Scanned(d2.scanned);
            setParent2ScannedAt(d2.scannedAt);
          }
        }
      } catch (err) {
        console.error("Error checking QR scans:", err);
      }
    };

    checkScans();
    const interval = setInterval(checkScans, 5000);
    return () => clearInterval(interval);
  }, [submitted, parent1, parent2]);

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isApiConnected) {
      alert("Backend server is not connected. Please check your connection.");
      return;
    }

    try {
      // 1. Check for duplicate student number
      const checkRes = await fetch(`${API_BASE_URL}/api/check-student-number`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNumber }),
      });

      if (!checkRes.ok) {
        setStudentNumberError("Server error. Please try again.");
        return;
      }

      const { exists } = await checkRes.json();
      if (exists) {
        setStudentNumberError("This student number is already registered.");
        return;
      }

      setStudentNumberError("");

      // 2. Generate QR image data URLs for storage/email
      const qr1DataUrl = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2DataUrl = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;

      // 3. Save registration
      const saveRes = await fetch(`${API_BASE_URL}/api/save-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName, studentNumber, course, email, contactNumber,
          parent1, parent2,
          qrCodeParent1: qr1DataUrl,
          qrCodeParent2: qr2DataUrl,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save registration.");
      }

      setSubmitted(true);
    } catch (err) {
      alert("Registration failed: " + err.message);
    }
  };

  // ── Send email ─────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const qr1DataUrl = await QRCodeLib.toDataURL(qrValueParent1);
      const qr2DataUrl = qrValueParent2 ? await QRCodeLib.toDataURL(qrValueParent2) : null;

      const res = await fetch(`${API_BASE_URL}/api/send-qr-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName, email,
          parent1, parent2,
          qrDataParent1: qr1DataUrl,
          qrDataParent2: qr2DataUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send email.");
      }

      setEmailSent(true);
      alert("QR codes sent to your email successfully!");
    } catch (err) {
      alert("Error sending email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">LCC Graduation Reservation</h1>
        <p className="form-description">
          Fill out the form below to reserve your spot for the LCC graduation ceremony.
          You can reserve up to 2 spots only. After submitting, a QR code will be generated
          for each reserved spot. Show the QR code(s) during graduation to gain entry.
          The QR code(s) will also be sent to your email for safekeeping.
        </p>

        {!isApiConnected && (
          <div className="warning-message">
            ⚠️ Connecting to server… Please wait or check your connection.
          </div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="form">
            <label className="form-label">Student Name <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Enter your full name" value={studentName}
              onChange={(e) => setStudentName(e.target.value)} className="form-input" required />

            <label className="form-label">Student Number <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Enter your student number" value={studentNumber}
              onChange={(e) => { setStudentNumber(e.target.value.replace(/[^0-9]/g, "")); setStudentNumberError(""); }}
              className="form-input" required />
            {studentNumberError && <p className="error-message">{studentNumberError}</p>}

            <label className="form-label">Course <span className="required-asterisk">*</span></label>
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="form-input" required>
              <option value="">Select a course</option>
              <option value="CELA">CELA</option>
              <option value="CBA">CBA</option>
              <option value="CCJE">CCJE</option>
              <option value="CON">CON</option>
              <option value="CITHM">CITHM</option>
              <option value="CCTE">CCTE</option>
            </select>

            <label className="form-label">Email <span className="required-asterisk">*</span></label>
            <input type="email" placeholder="your.email@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className="form-input" required />

            <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
            <input type="tel" placeholder="09123456789" value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value.replace(/[^0-9]/g, ""))}
              className="form-input" required />

            <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
            <input type="text" placeholder="Parent/Guardian 1 full name" value={parent1}
              onChange={(e) => setParent1(e.target.value)} className="form-input" required />

            <label className="form-label">Parent 2 Name (Optional)</label>
            <input type="text" placeholder="Parent/Guardian 2 full name" value={parent2}
              onChange={(e) => setParent2(e.target.value)} className="form-input" />

            <button type="submit" className="submit-btn" disabled={!isApiConnected}>
              Generate QR Code
            </button>
          </form>
        ) : (
          <div className="qr-section">
            <p className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</p>
            <div className="qr-container">

              {/* Parent 1 QR */}
              <div className={`qr-item ${parent1Scanned ? "scanned" : ""}`}>
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <div className="qr-wrapper">
                  <QRCode value={qrValueParent1} size={200} />
                  {parent1Scanned && (
                    <div className="qr-overlay">
                      <div className="qr-status">
                        <span className="scan-badge">✓ SCANNED</span>
                        <p className="scan-time">
                          {parent1ScannedAt
                            ? new Date(parent1ScannedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parent 2 QR */}
              {parent2 && (
                <div className={`qr-item ${parent2Scanned ? "scanned" : ""}`}>
                  <p className="qr-parent-label">{parent2}</p>
                  <div className="qr-wrapper">
                    <QRCode value={qrValueParent2} size={200} />
                    {parent2Scanned && (
                      <div className="qr-overlay">
                        <div className="qr-status">
                          <span className="scan-badge">✓ SCANNED</span>
                          <p className="scan-time">
                            {parent2ScannedAt
                              ? new Date(parent2ScannedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
                              : ""}
                          </p>
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