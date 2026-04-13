import { useState } from "react";
import QRCode from "react-qr-code";
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

      // Student number is unique, clear error and proceed with form
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
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.error("Error saving to Supabase:", data.error);
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
      console.error("Error:", error);
    }
  };

  const qrDataParent1 = JSON.stringify({
    studentName,
    studentNumber,
    course,
    email,
    contactNumber,
    parentName: parent1,
    type: "Graduation Reservation"
  });

  const qrDataParent2 = parent2 ? JSON.stringify({
    studentName,
    studentNumber,
    course,
    email,
    contactNumber,
    parentName: parent2,
    type: "Graduation Reservation"
  }) : null;

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

  return (
    <div className="app-container">
      <div className="form-card">
        <h1 className="form-title">
         LCC Graduation Reservation
        </h1>
        <p1 className="form-description">
          Fill out the form below to reserve your spot for the LCC graduation ceremony. You can reserve up to 2 spots only. After submitting, a QR code will be generated for each reserved spot. Show the QR code(s) during graduation to gain entry. You can also choose to have the QR code(s) sent to your email for convenience.
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
            <input
              type="text"
              placeholder="Course"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="form-input"
            />

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

            <label className="form-label">Parent 2 Name</label>
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
              <div className="qr-item">
                {parent2 && <p className="qr-parent-label">{parent1}</p>}
                <QRCode value={qrDataParent1} />
              </div>
              {parent2 && (
                <div className="qr-item">
                  <p className="qr-parent-label">{parent2}</p>
                  <QRCode value={qrDataParent2} />
                </div>
              )}
            </div>

            <p className="qr-text">
              Show {parent2 ? "these QR codes" : "this QR code"} during graduation
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
