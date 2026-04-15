import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import "./App.css";
import QRCodeLib from "qrcode";
import { useSearchParams } from "react-router-dom";
import ReactDOM from "react-dom/client";

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


  
const qrDataParent1 = `${window.location.origin}/scan?parent=${encodeURIComponent(parent1)}`;

const qrDataParent2 = parent2
  ? `${window.location.origin}/scan?parent=${encodeURIComponent(parent2)}`
  : null;


  // Check QR scan status when component submitted
  useEffect(() => {
    if (submitted) {
      checkQRScans();
      // Auto-check every 5 seconds for updates
      const scanCheckInterval = setInterval(checkQRScans, 5000);
      return () => clearInterval(scanCheckInterval);
    }
  }, [submitted, parent1, parent2]);

  const checkQRScans = async () => {
    try {
      // Check parent1 scan status
      const response1 = await fetch("http://localhost:5000/api/check-qr-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentName: parent1,
        }),
      });

      if (response1.ok) {
        const data1 = await response1.json();
        setParent1Scanned(data1.scanned);
        setParent1ScannedAt(data1.scannedAt);
      }

      // Check parent2 scan status if exists
      if (parent2) {
        const response2 = await fetch("http://localhost:5000/api/check-qr-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parentName: parent2,
          }),
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
    if (!studentName || !studentNumber || !course || !email || !contactNumber || !parent1) {
      alert("Please fill all fields (Parent 2 is optional)");
      return;
    }
    
    // Check for duplicate student number
    checkStudentNumber();
  };

  const checkStudentNumber = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/check-student-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentNumber,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setStudentNumberError(data.error || "Failed to check student number");
        } else {
          setStudentNumberError("Server error. Make sure the backend server is running on port 5000.");
        }
        return;
      }

      const data = await response.json();

      if (data.exists) {
        setStudentNumberError("This student number is already registered. Please use a different student number.");
        return;
      }

      
      setStudentNumberError("");
      saveToSupabase();
      setSubmitted(true);
    } catch (error) {
      console.error("Error:", error);
      setStudentNumberError("Connection error. Make sure the backend server is running on port 5000.");
    }
  };

  const saveToSupabase = async () => {
    try {
      console.log("=== saveToSupabase started ===");
      console.log("QR Data Parent1:", qrDataParent1);
      console.log("QR Data Parent2:", qrDataParent2);

      // Generate QR code data URLs
      console.log("Generating QR code for Parent1...");
      const qr1DataUrl = await QRCodeLib.toDataURL(qrDataParent1);
      console.log("QR1 generated, length:", qr1DataUrl.length);

      let qr2DataUrl = null;
      if (qrDataParent2) {
        console.log("Generating QR code for Parent2...");
        qr2DataUrl = await QRCodeLib.toDataURL(qrDataParent2);
        console.log("QR2 generated, length:", qr2DataUrl.length);
      }

      console.log("Sending to backend...");
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

      console.log("Response status:", response.status);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.error("Error saving to Supabase:", data.error);
          console.error("Error details:", data.details);
        } else {
          console.error("Server error - not valid JSON response");
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        console.log("Registration saved successfully");
      }
    } catch (error) {
      console.error("=== Exception in saveToSupabase ===");
      console.error("Error:", error);
      console.error("Stack trace:", error.stack);
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

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          alert("Error sending email: " + (data.error || "Unknown error"));
        } else {
          alert("Server error. Please make sure the backend server is running on port 5000.");
        }
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
        alert("QR codes sent to your email successfully!");
      } else {
        alert("Error sending email: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Connection error. Make sure the backend server is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const scanQr = async () => {
      const response = await fetch("http://localhost:5000/api/scan-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ parentName })
      });

      const data = await response.json();

      if (data.success) {
        setMessage("QR code accepted");
      } else if (data.inactive) {
        setMessage(`QR code already used at ${data.scannedAt}`);
      } else {
        setMessage(data.error || "Failed to scan QR code");
      }
    };

    if (parentName) {
      scanQr();
    }
  }, [parentName]);

  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">
         LCC Graduation Reservation
        </h1>
        <p1 className="form-description">
          Fill out the form below to reserve your spot for the LCC graduation ceremony. 
          You can reserve up to 2 spots only. After submitting, a QR code will be generated for each reserved spot. 
          Show the QR code(s) during graduation to gain entry. 
          The QR code(s) will also be sent to your email for safekeeping.
        </p1>
        {!submitted ? (
          <form onSubmit={handleSubmit} className="form">
            <label className="form-label">Student Name <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Student Name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="form-input"
            />

            <label className="form-label">Student Number <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Student Number"
              value={studentNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setStudentNumber(value);
                setStudentNumberError("");
              }}
              className="form-input"
            />
            {studentNumberError && (
              <p className="error-message">{studentNumberError}</p>
            )}

            <label className="form-label">Course <span className="required-asterisk">*</span></label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="form-input"
            >
              <option value="">Select a course</option>
              <option value="CELA">CELA</option>
              <option value="CBA">CBA</option>
              <option value="CCJE">CCJE</option>
              <option value="CON">CON</option>
              <option value="CITHM">CITHM</option>
              <option value="CCTE">CCTE</option>
            </select>

            <label className="form-label">Email <span className="required-asterisk">*</span></label>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />

            <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
            <input
              type="tel"
              placeholder="Contact Number"
              value={contactNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setContactNumber(value);
              }}
              className="form-input"
            />

            <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Parent 1 Name"
              value={parent1}
              onChange={(e) => setParent1(e.target.value)}
              className="form-input"
            />

            <label className="form-label">Parent 2 Name(Optional)</label>
            <input
              type="text"
              placeholder="Parent 2 Name"
              value={parent2}
              onChange={(e) => setParent2(e.target.value)}
              className="form-input"
            />

            <button
              type="submit"
              className="submit-btn"
            >
              Generate QR Code
            </button>
          </form>
        ) : (
          <div className="qr-section">
            <p className="qr-title">Reservation QR Code{parent2 ? "s" : ""}</p>
            <div className="qr-container">
              <div className={`qr-item ${parent1Scanned ? "scanned" : ""}`}>
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <div className="qr-wrapper">
                  <QRCode value={qrDataParent1} />
                  {parent1Scanned && (
                    <div className="qr-overlay">
                      <div className="qr-status">
                        <span className="scan-badge">✓ SCANNED</span>
                        <p className="scan-time">
                          {parent1ScannedAt ? new Date(parent1ScannedAt).toLocaleString() : ""}
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
                            {parent2ScannedAt ? new Date(parent2ScannedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="qr-text">
              Show {parent2 ? "these QR codes" : "this QR code"} during graduation. Do not share these to others it is a one time use only.
            </p>

            {emailSent ? (
              <p className="email-sent-message">✓ QR codes sent to {email}</p>
            ) : (
              <button
                onClick={handleSendEmail}
                disabled={loading}
                className="send-email-btn"
              >
                {loading ? "Sending..." : "Send QR Codes to Email"}
              </button>
            )}

            <button
              onClick={() => {
                setSubmitted(false);
                setEmailSent(false);
              }}
              className="back-btn"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
