import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import "./App.css";

export default function App() {
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [course, setCourse] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [parent1, setParent1] = useState("");
  const [parent2, setParent2] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [studentNumberError, setStudentNumberError] = useState("");

  const [parent1Scanned, setParent1Scanned] = useState(false);
  const [parent2Scanned, setParent2Scanned] = useState(false);
  const [parent1ScannedAt, setParent1ScannedAt] = useState(null);
  const [parent2ScannedAt, setParent2ScannedAt] = useState(null);

  const [searchParams] = useSearchParams();
  const parentName = searchParams.get("parent");
  const [message, setMessage] = useState("Checking QR code...");

  // QR data becomes a URL that can be opened/scanned externally
  const qrDataParent1 = `${window.location.origin}/?parent=${encodeURIComponent(parent1)}`;

  const qrDataParent2 = parent2
    ? `${window.location.origin}/?parent=${encodeURIComponent(parent2)}`
    : null;

  // When page is opened from a QR code, automatically scan it
  useEffect(() => {
    const scanQr = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/scan-qr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parentName }),
        });

        const data = await response.json();

        if (data.success) {
          setMessage("QR code accepted");
        } else if (data.inactive) {
          setMessage(`QR code already used at ${new Date(data.scannedAt).toLocaleString()}`);
        } else {
          setMessage(data.error || "Failed to scan QR code");
        }
      } catch (error) {
        console.error(error);
        setMessage("Unable to connect to the server");
      }
    };

    if (parentName) {
      scanQr();
    }
  }, [parentName]);

  // If user is opening the page from a QR code, show scan result page only
  useEffect(() => {
  if (submitted) {
    checkQRScans();

    const interval = setInterval(() => {
      checkQRScans();
    }, 5000);

    return () => clearInterval(interval);
  }
}, [submitted, parent1, parent2]);

// ✅ AFTER all hooks
if (parentName) {
  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">LCC Graduation QR Scanner</h1>

        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <p
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: message.includes("accepted")
                ? "green"
                : message.includes("already used")
                ? "red"
                : "#333",
            }}
          >
            {message}
          </p>

          {message.includes("accepted") && (
            <p style={{ marginTop: "12px", fontSize: "18px" }}>
              Entry approved for {parentName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

  const checkQRScans = async () => {
    try {
      const response1 = await fetch("http://localhost:5000/api/check-qr-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parentName: parent1 }),
      });

      if (response1.ok) {
        const data1 = await response1.json();
        setParent1Scanned(data1.scanned);
        setParent1ScannedAt(data1.scannedAt);
      }

      if (parent2) {
        const response2 = await fetch("http://localhost:5000/api/check-qr-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parentName: parent2 }),
        });

        if (response2.ok) {
          const data2 = await response2.json();
          setParent2Scanned(data2.scanned);
          setParent2ScannedAt(data2.scannedAt);
        }
      }
    } catch (error) {
      console.error("Error checking QR scans:", error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !studentName ||
      !studentNumber ||
      !course ||
      !email ||
      !contactNumber ||
      !parent1
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    checkStudentNumber();
  };

  const checkStudentNumber = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/check-student-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentNumber }),
      });

      const data = await response.json();

      if (data.exists) {
        setStudentNumberError("This student number is already registered.");
        return;
      }

      setStudentNumberError("");
      await saveToSupabase();
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setStudentNumberError("Could not connect to the backend.");
    }
  };

  const saveToSupabase = async () => {
    try {
      const qr1DataUrl = await QRCodeLib.toDataURL(qrDataParent1);

      let qr2DataUrl = null;
      if (qrDataParent2) {
        qr2DataUrl = await QRCodeLib.toDataURL(qrDataParent2);
      }

      const response = await fetch("http://localhost:5000/api/save-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentName,
          studentNumber,
          course,
          email,
          contactNumber,
          parent1,
          parent2,
          qrCodeParent1: qr1DataUrl,
          qrCodeParent2: qr2DataUrl,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.error || "Failed to save registration");
      }
    } catch (error) {
      console.error(error);
      alert("Error saving registration");
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/send-qr-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentName,
          email,
          parent1,
          parent2,
          qrDataParent1,
          qrDataParent2,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
      } else {
        alert(data.error || "Failed to send email");
      }
    } catch (error) {
      console.error(error);
      alert("Could not send email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">LCC Graduation Reservation</h1>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="form">
            <input
              type="text"
              placeholder="Student Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="form-input"
            />

            <input
              type="text"
              placeholder="Student Number"
              value={studentNumber}
              onChange={(e) => {
                setStudentNumber(e.target.value.replace(/[^0-9]/g, ""));
                setStudentNumberError("");
              }}
              className="form-input"
            />

            {studentNumberError && (
              <p className="error-message">{studentNumberError}</p>
            )}

            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="form-input"
            >
              <option value="">Select Course</option>
              <option value="CELA">CELA</option>
              <option value="CBA">CBA</option>
              <option value="CCJE">CCJE</option>
              <option value="CON">CON</option>
              <option value="CITHM">CITHM</option>
              <option value="CCTE">CCTE</option>
            </select>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />

            <input
              type="text"
              placeholder="Contact Number"
              value={contactNumber}
              onChange={(e) =>
                setContactNumber(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="form-input"
            />

            <input
              type="text"
              placeholder="Parent 1 Name"
              value={parent1}
              onChange={(e) => setParent1(e.target.value)}
              className="form-input"
            />

            <input
              type="text"
              placeholder="Parent 2 Name (Optional)"
              value={parent2}
              onChange={(e) => setParent2(e.target.value)}
              className="form-input"
            />

            <button type="submit" className="submit-btn">
              Generate QR Code
            </button>
          </form>
        ) : (
          <div className="qr-section">
            <h2 className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</h2>

            <div className="qr-container">
              <div className={`qr-item ${parent1Scanned ? "scanned" : ""}`}>
                <p className="qr-parent-label">{parent1}</p>

                <div className="qr-wrapper">
                  <QRCode value={qrDataParent1} />

                  {parent1Scanned && (
                    <div className="qr-overlay">
                      <div className="qr-status">
                        <span className="scan-badge">✓ SCANNED</span>
                        <p className="scan-time">
                          {new Date(parent1ScannedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {parent2 && (
                <div className={`qr-item ${parent2Scanned ? "scanned" : ""}`}>
                  <p className="qr-parent-label">{parent2}</p>

                  <div className="qr-wrapper">
                    <QRCode value={qrDataParent2} />

                    {parent2Scanned && (
                      <div className="qr-overlay">
                        <div className="qr-status">
                          <span className="scan-badge">✓ SCANNED</span>
                          <p className="scan-time">
                            {new Date(parent2ScannedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="qr-text">
              Show this QR code during graduation. It can only be used once.
            </p>

            {!emailSent ? (
              <button
                className="send-email-btn"
                onClick={handleSendEmail}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send QR Codes to Email"}
              </button>
            ) : (
              <p className="email-sent-message">QR codes sent to {email}</p>
            )}

            <button
              className="back-btn"
              onClick={() => {
                setSubmitted(false);
                setEmailSent(false);
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
