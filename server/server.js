const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Configure email service
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use app-specific password for Gmail
  },
});

// Helper function to generate QR code as data URL
const generateQRCodeDataUrl = async (data) => {
  try {
    return await QRCode.toDataURL(data);
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
};

// Helper function to convert data URL to buffer
const dataUrlToBuffer = (dataUrl) => {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64Data, "base64");
};

// Send email endpoint
app.post("/api/send-qr-email", async (req, res) => {
  try {
    const { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 } = req.body;

    if (!email || !studentName || !qrDataParent1) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Generate QR code data URLs
    const qr1DataUrl = await generateQRCodeDataUrl(qrDataParent1);
    const qr2DataUrl = qrDataParent2 ? await generateQRCodeDataUrl(qrDataParent2) : null;

    // Prepare attachments
    const attachments = [
      {
        filename: `QR_${parent1}.png`,
        content: dataUrlToBuffer(qr1DataUrl),
        contentType: "image/png",
      },
    ];

    if (qr2DataUrl) {
      attachments.push({
        filename: `QR_${parent2}.png`,
        content: dataUrlToBuffer(qr2DataUrl),
        contentType: "image/png",
      });
    }

    // Create email content
    const emailSubject = "Your Graduation Reservation QR Codes";
    const emailHtml = `
      <h2>Hello ${studentName},</h2>
      <p>Your graduation reservation QR codes have been generated and are attached to this email.</p>
      <p><strong>Instructions:</strong> Please show the QR code(s) during graduation.</p>
      <p>${parent2 ? `<strong>You have QR codes for both parents (${parent1} and ${parent2}).</strong>` : `<strong>Your QR code for ${parent1}.</strong>`}</p>
      <p><strong>Warning:</strong>Do not share these to others as they are for one-time use only.</p>
      <p>Best regards,<br>Graduation Team</p>
      <p><strong>This is a system-generated email. Please do not reply.</strong></p>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: emailSubject,
      html: emailHtml,
      attachments: attachments,
    });

    res.json({
      success: true,
      message: "QR codes sent to email successfully",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
});

// Check for duplicate student number endpoint
app.post("/api/check-student-number", async (req, res) => {
  try {
    const { studentNumber } = req.body;

    if (!studentNumber) {
      return res.status(400).json({ error: "Student number is required" });
    }

    const { data, error } = await supabase
      .from("registrations")
      .select("student_number")
      .eq("student_number", studentNumber);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to check student number", details: error.message });
    }

    if (data && data.length > 0) {
      return res.json({ exists: true, message: "Student number already registered" });
    }

    res.json({ exists: false, message: "Student number is available" });
  } catch (error) {
    console.error("Error checking student number:", error);
    res.status(500).json({ error: "Failed to check student number", details: error.message });
  }
});

// Save form data to Supabase endpoint
app.post("/api/save-registration", async (req, res) => {
  try {
    const { studentName, studentNumber, course, email, contactNumber, parent1, parent2 } = req.body;

    if (!studentName || !studentNumber || !course || !email || !contactNumber || !parent1) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("registrations")
      .insert([
        {
          student_name: studentName,
          student_number: studentNumber,
          course: course,
          email: email,
          contact_number: contactNumber,
          parent1: parent1,
          parent2: parent2 || null,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to save registration", details: error.message });
    }

    res.json({
      success: true,
      message: "Registration saved successfully",
      data: data,
    });
  } catch (error) {
    console.error("Error saving registration:", error);
    res.status(500).json({ error: "Failed to save registration", details: error.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
