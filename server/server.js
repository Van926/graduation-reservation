const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const { createClient } = require("../../../../../../backend/server/node_modules/@supabase/supabase-js/src/lib/rest/types/common/common");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, 
  },
});


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

    console.log("=== send-qr-email endpoint ===");
    console.log("Received request body:", { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 });

    if (!email || !studentName || !qrDataParent1) {
      console.error("Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("Generating QR codes...");
    // Generate QR code data URLs
    const qr1DataUrl = await generateQRCodeDataUrl(qrDataParent1);
    console.log("QR1 generated successfully");
    
    const qr2DataUrl = qrDataParent2 ? await generateQRCodeDataUrl(qrDataParent2) : null;
    console.log("QR2 generated successfully");

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

    console.log("Attachments prepared:", attachments.length, "files");

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
    console.log("Attempting to send email to:", email);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: emailSubject,
      html: emailHtml,
      attachments: attachments,
    });

    console.log("Email sent successfully");
    res.json({
      success: true,
      message: "QR codes sent to email successfully",
    });
  } catch (error) {
    console.error("=== ERROR in send-qr-email ===");
    console.error("Error message:", error.message);
    console.error("Full error:", error);
    console.error("Stack trace:", error.stack);
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
    const { studentName, studentNumber, course, email, contactNumber, parent1, parent2, qrCodeParent1, qrCodeParent2 } = req.body;

    console.log("=== save-registration endpoint ===");
    console.log("Received:", { studentName, studentNumber, course, email, contactNumber, parent1, parent2 });

    if (!studentName || !studentNumber || !course || !email || !contactNumber || !parent1) {
      console.log("Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("QR1 length:", qrCodeParent1?.length);
    console.log("QR2 length:", qrCodeParent2?.length);

    // First, try without QR codes to test basic registration
    console.log("Attempting to insert basic record (without QR codes)...");
    
    const basicData = {
      student_name: studentName,
      student_number: studentNumber,
      course: course,
      email: email,
      contact_number: contactNumber,
      parent1: parent1,
      parent2: parent2 || null,
      created_at: new Date().toISOString(),
    };

    const { data: basicData_result, error: basicError } = await supabase
      .from("registrations")
      .insert([basicData])
      .select();

    if (basicError) {
      console.error("BASIC INSERT FAILED:");
      console.error("Code:", basicError.code);
      console.error("Message:", basicError.message);
      console.error("Details:", basicError.details);
      return res.status(500).json({ 
        error: "Failed to save registration",
        details: basicError.message,
        code: basicError.code
      });
    }

    console.log("✓ Basic insert successful");
    console.log("Inserted record ID:", basicData_result?.[0]?.id);

    // Now try to add QR codes if they exist (UPDATE the record)
    if ((qrCodeParent1 || qrCodeParent2) && basicData_result?.[0]?.id) {
      console.log("Now attempting to update with QR codes...");
      
      const updateData = {};
      if (qrCodeParent1) updateData.qr_code_parent1 = qrCodeParent1;
      if (qrCodeParent2) updateData.qr_code_parent2 = qrCodeParent2;

      const { data: updateResult, error: updateError } = await supabase
        .from("registrations")
        .update(updateData)
        .eq("id", basicData_result[0].id)
        .select();

      if (updateError) {
        console.error("⚠ UPDATE WITH QR CODES failed (but basic registration was saved):");
        console.error("Code:", updateError.code);
        console.error("Message:", updateError.message);
        // Don't return error - registration already saved
        console.log("Continuing anyway - basic registration is saved");
      } else {
        console.log("✓ QR codes added successfully");
      }
    }

    res.json({
      success: true,
      message: "Registration saved successfully",
      data: basicData_result,
    });

  } catch (error) {
    console.error("=== EXCEPTION ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({ 
      error: "Failed to save registration", 
      details: error.message 
    });
  }
});

// Scan QR code endpoint - records when a QR code is scanned
app.post("/api/scan-qr", async (req, res) => {
  try {
    const { qrData, parentName } = req.body;

    if (!qrData || !parentName) {
      return res.status(400).json({ error: "QR data and parent name are required" });
    }

    const scanTimestamp = new Date().toISOString();

    // Find the registration record with this parent name
    const { data: registrations, error: fetchError } = await supabase
      .from("registrations")
      .select("id, parent1, parent2")
      .or(`parent1.eq.${parentName},parent2.eq.${parentName}`);

    if (fetchError) {
      console.error("Error fetching registration:", fetchError);
      return res.status(500).json({ error: "Failed to find registration", details: fetchError.message });
    }

    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const registration = registrations[0];
    const isParent1 = registration.parent1 === parentName;

    // Update the scanned_at timestamp for the appropriate parent
    const updateField = isParent1 ? "scanned_at_parent1" : "scanned_at_parent2";
    const { error: updateError } = await supabase
      .from("registrations")
      .update({ [updateField]: scanTimestamp })
      .eq("id", registration.id);

    if (updateError) {
      console.error("Error recording scan:", updateError);
      return res.status(500).json({ error: "Failed to record scan", details: updateError.message });
    }

    console.log(`QR code scanned for ${parentName} at ${scanTimestamp}`);
    res.json({ success: true, scannedAt: scanTimestamp });
  } catch (error) {
    console.error("Error in scan-qr endpoint:", error);
    res.status(500).json({ error: "Failed to scan QR code", details: error.message });
  }
});

// Check QR scan status endpoint
app.post("/api/check-qr-status", async (req, res) => {
  try {
    const { parentName } = req.body;

    if (!parentName) {
      return res.status(400).json({ error: "Parent name is required" });
    }

    // Find the registration record with this parent name
    const { data: registrations, error: fetchError } = await supabase
      .from("registrations")
      .select("id, parent1, parent2, scanned_at_parent1, scanned_at_parent2")
      .or(`parent1.eq.${parentName},parent2.eq.${parentName}`);

    if (fetchError) {
      console.error("Error fetching registration:", fetchError);
      return res.status(500).json({ error: "Failed to find registration", details: fetchError.message });
    }

    if (!registrations || registrations.length === 0) {
      return res.json({ scanned: false, scannedAt: null });
    }

    const registration = registrations[0];
    const isParent1 = registration.parent1 === parentName;
    const scanField = isParent1 ? registration.scanned_at_parent1 : registration.scanned_at_parent2;
    const isScanned = scanField !== null;

    res.json({ 
      success: true,
      scanned: isScanned, 
      scannedAt: isScanned ? scanField : null 
    });
  } catch (error) {
    console.error("Error in check-qr-status endpoint:", error);
    res.status(500).json({ error: "Failed to check QR status", details: error.message });
  }
});

// Test endpoint to check Supabase table structure
app.get("/api/test-supabase", async (req, res) => {
  try {
    console.log("=== Testing Supabase connection ===");
    
    // Try to fetch one record to see the table structure
    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .limit(1);

    if (error) {
      console.error("Error connecting to Supabase:", error);
      return res.status(500).json({ 
        error: "Failed to connect to Supabase",
        details: error.message,
        code: error.code
      });
    }

    console.log("Supabase connection successful");
    console.log("Sample record structure:", data?.[0] ? Object.keys(data[0]) : "No records yet");

    res.json({
      success: true,
      message: "Supabase connection successful",
      columns: data?.[0] ? Object.keys(data[0]) : "No data yet",
      sampleRecord: data?.[0] || null
    });
  } catch (error) {
    console.error("Exception:", error);
    res.status(500).json({ 
      error: "Failed to test Supabase",
      details: error.message 
    });
  }
});

// Scan QR code endpoint - records when a QR code is scanned only once
app.post("/api/scan-qr", async (req, res) => {
  try {
    const { parentName } = req.body;

    if (!parentName) {
      return res.status(400).json({ error: "Parent name is required" });
    }

    const scanTimestamp = new Date().toISOString();

    // Find registration
    const { data: registrations, error: fetchError } = await supabase
      .from("registrations")
      .select(`
        id,
        parent1,
        parent2,
        scanned_at_parent1,
        scanned_at_parent2
      `)
      .or(`parent1.eq.${parentName},parent2.eq.${parentName}`);

    if (fetchError) {
      return res.status(500).json({
        error: "Failed to find registration",
        details: fetchError.message
      });
    }

    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const registration = registrations[0];
    const isParent1 = registration.parent1 === parentName;

    const scanField = isParent1
      ? "scanned_at_parent1"
      : "scanned_at_parent2";

    // If already scanned, make QR inactive
    if (registration[scanField]) {
      return res.status(400).json({
        success: false,
        inactive: true,
        message: "QR code already used",
        scannedAt: registration[scanField]
      });
    }

    // Mark QR as scanned / inactive
    const { error: updateError } = await supabase
      .from("registrations")
      .update({
        [scanField]: scanTimestamp
      })
      .eq("id", registration.id);

    if (updateError) {
      return res.status(500).json({
        error: "Failed to record scan",
        details: updateError.message
      });
    }

    res.json({
      success: true,
      inactive: false,
      message: "QR code accepted",
      scannedAt: scanTimestamp
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to scan QR code",
      details: error.message
    });
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