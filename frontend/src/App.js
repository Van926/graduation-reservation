import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import "./App.css";
import QRCodeLib from "qrcode";

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://grad-reservation-backend.vercel.app';

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
  const [showScanPage, setShowScanPage] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);

  // Generate QR code data
  const qrDataParent1 = `${window.location.origin}/scan?parent=${encodeURIComponent(parent1)}`;
  const qrDataParent2 = parent2
    ? `${window.location.origin}/scan?parent=${encodeURIComponent(parent2)}`
    : null;

  // Test backend connection on mount
  useEffect(() => {
    const testBackendConnection = async () => {
      try {
        console.log('Testing backend connection...');
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Backend connected:', data);
          setIsApiConnected(true);
        } else {
          console.error('Backend responded with status:', response.status);
          setIsApiConnected(false);
        }
      } catch (error) {
        console.error('Backend connection failed:', error);
        setIsApiConnected(false);
      }
    };
    
    testBackendConnection();
  }, []);

  // Check if we're in scan mode based on URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const parentParam = urlParams.get("parent");
    if (parentParam) {
      setShowScanPage(true);
    }
  }, []);

  // Check QR scan status when component submitted
  useEffect(() => {
    if (submitted) {
      checkQRScans();
      const scanCheckInterval = setInterval(checkQRScans, 5000);
      return () => clearInterval(scanCheckInterval);
    }
  }, [submitted, parent1, parent2]);

  const checkQRScans = async () => {
    try {
      console.log('Checking QR scans...');
      
      // Check parent1 scan status
      const response1 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
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
        const response2 = await fetch(`${API_BASE_URL}/api/check-qr-status`, {
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
    
    if (!isApiConnected) {
      alert("Backend server is not connected. Please check your connection.");
      return;
    }
    
    checkStudentNumber();
  };

  const checkStudentNumber = async () => {
    try {
      console.log('Checking student number:', studentNumber);
      
      const response = await fetch(`${API_BASE_URL}/api/check-student-number`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentNumber,
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setStudentNumberError("Server error. Please try again.");
        return;
      }

      const data = await response.json();
      console.log('Student number check result:', data);

      if (data.exists) {
        setStudentNumberError("This student number is already registered. Please use a different student number.");
        return;
      }

      setStudentNumberError("");
      await saveToSupabase();
      setSubmitted(true);
    } catch (error) {
      console.error("Error in checkStudentNumber:", error);
      setStudentNumberError("Connection error: " + error.message);
    }
  };

  const saveToSupabase = async () => {
    try {
      console.log("=== saveToSupabase started ===");
      console.log("QR Data Parent1:", qrDataParent1);
      console.log("QR Data Parent2:", qrDataParent2);

      // Generate QR code data URLs
      const qr1DataUrl = await QRCodeLib.toDataURL(qrDataParent1);
      console.log("QR1 generated, length:", qr1DataUrl.length);

      let qr2DataUrl = null;
      if (qrDataParent2) {
        console.log("Generating QR code for Parent2...");
        qr2DataUrl = await QRCodeLib.toDataURL(qrDataParent2);
        console.log("QR2 generated, length:", qr2DataUrl.length);
      }

      console.log("Sending to backend...");
      const response = await fetch(`${API_BASE_URL}/api/save-registration`, {
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
        const errorData = await response.json();
        console.error("Error saving to Supabase:", errorData);
        throw new Error(errorData.error || "Failed to save registration");
      }

      const data = await response.json();
      console.log("Save result:", data);

      if (data.success) {
        console.log("Registration saved successfully");
      } else {
        throw new Error("Save was not successful");
      }
    } catch (error) {
      console.error("=== Exception in saveToSupabase ===");
      console.error("Error:", error);
      alert("Failed to save registration: " + error.message);
      throw error;
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      console.log("Sending email...");
      
      const response = await fetch(`${API_BASE_URL}/api/send-qr-email`, {
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

      console.log("Email response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send email");
      }

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
        alert("QR codes sent to your email successfully!");
      } else {
        throw new Error(data.error || "Unknown error sending email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Error sending email: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Scan Page Component
  const ScanPage = () => {
    const [searchParams] = useSearchParams();
    const parentName = searchParams.get("parent");
    const [scanMessage, setScanMessage] = useState("Checking QR code...");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const scanQr = async () => {
        if (!parentName) {
          setScanMessage("Invalid QR code - No parent information found");
          setIsLoading(false);
          return;
        }

        try {
          console.log("Scanning QR for:", parentName);
          
          const response = await fetch(`${API_BASE_URL}/api/scan-qr`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ parentName })
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setScanMessage("✓ QR code accepted! You may now enter.");
          } else if (data.inactive) {
            setScanMessage(`⚠️ This QR code was already used at ${new Date(data.scannedAt).toLocaleString()}`);
          } else {
            setScanMessage(`❌ ${data.error || "Failed to scan QR code"}`);
          }
        } catch (error) {
          console.error("Error scanning QR:", error);
          setScanMessage("❌ Connection error. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      scanQr();
    }, [parentName]);

    return (
      <div className="scan-page-container">
        <div className="scan-card">
          {isLoading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>{scanMessage}</p>
            </div>
          ) : (
            <>
              <h1 className={scanMessage.includes("accepted") ? "success-message" : "error-message"}>
                {scanMessage}
              </h1>
              <button onClick={() => window.location.href = '/'} className="back-btn">
                Back to Registration
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (showScanPage) {
    return <ScanPage />;
  }

  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">
          LCC Graduation Reservation
        </h1>
        <p className="form-description">
          Fill out the form below to reserve your spot for the LCC graduation ceremony. 
          You can reserve up to 2 spots only. After submitting, a QR code will be generated for each reserved spot. 
          Show the QR code(s) during graduation to gain entry. 
          The QR code(s) will also be sent to your email for safekeeping.
        </p>
        
        {!isApiConnected && (
          <div className="warning-message">
            ⚠️ Connecting to server... Please wait or check your connection.
          </div>
        )}
        
        {!submitted ? (
          <form onSubmit={handleSubmit} className="form">
            <label className="form-label">Student Name <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="form-input"
              required
            />

            <label className="form-label">Student Number <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Enter your student number"
              value={studentNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setStudentNumber(value);
                setStudentNumberError("");
              }}
              className="form-input"
              required
            />
            {studentNumberError && (
              <p className="error-message">{studentNumberError}</p>
            )}

            <label className="form-label">Course <span className="required-asterisk">*</span></label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="form-input"
              required
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
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />

            <label className="form-label">Contact Number <span className="required-asterisk">*</span></label>
            <input
              type="tel"
              placeholder="09123456789"
              value={contactNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setContactNumber(value);
              }}
              className="form-input"
              required
            />

            <label className="form-label">Parent 1 Name <span className="required-asterisk">*</span></label>
            <input
              type="text"
              placeholder="Parent/Guardian 1 full name"
              value={parent1}
              onChange={(e) => setParent1(e.target.value)}
              className="form-input"
              required
            />

            <label className="form-label">Parent 2 Name (Optional)</label>
            <input
              type="text"
              placeholder="Parent/Guardian 2 full name"
              value={parent2}
              onChange={(e) => setParent2(e.target.value)}
              className="form-input"
            />

            <button type="submit" className="submit-btn" disabled={!isApiConnected}>
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
                  <QRCode value={qrDataParent1} size={200} />
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
                    <QRCode value={qrDataParent2} size={200} />
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
              Show {parent2 ? "these QR codes" : "this QR code"} during graduation. 
              Do not share these with others as they are one-time use only.
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
              Back to Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}