const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://graduation-reservation-frontend.vercel.app',
     // Add your preview URLs if needed
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize Email
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cors: 'Configured'
  });
});

// Check student number
app.post('/api/check-student-number', async (req, res) => {
  try {
    const { studentNumber } = req.body;
    
    const { data, error } = await supabase
      .from('registrations')
      .select('student_number')
      .eq('student_number', studentNumber)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ exists: !!data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save registration
app.post('/api/save-registration', async (req, res) => {
  try {
    const {
      studentName,
      studentNumber,
      course,
      email,
      contactNumber,
      parent1,
      parent2,
      qrCodeParent1,
      qrCodeParent2
    } = req.body;
    
    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          student_name: studentName,
          student_number: studentNumber,
          course,
          email,
          contact_number: contactNumber,
          parent1_name: parent1,
          parent2_name: parent2 || null,
          qr_code_parent1: qrCodeParent1,
          qr_code_parent2: qrCodeParent2 || null,
          parent1_scanned: false,
          parent2_scanned: false
        }
      ]);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scan QR code
app.post('/api/scan-qr', async (req, res) => {
  try {
    const { parentName } = req.body;
    
    if (!parentName) {
      return res.status(400).json({ error: "Parent name is required" });
    }
    
    const { data, error } = await supabase
      .from('registrations')
      .select('parent1_name, parent2_name, parent1_scanned, parent2_scanned, parent1_scanned_at, parent2_scanned_at')
      .or(`parent1_name.eq.${parentName},parent2_name.eq.${parentName}`)
      .single();
    
    if (error) {
      return res.status(404).json({ error: "QR code not found" });
    }
    
    const isParent1 = data.parent1_name === parentName;
    const scanned = isParent1 ? data.parent1_scanned : data.parent2_scanned;
    
    if (scanned) {
      return res.json({ 
        inactive: true, 
        scannedAt: isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at 
      });
    }
    
    const updateData = isParent1
      ? { parent1_scanned: true, parent1_scanned_at: new Date() }
      : { parent2_scanned: true, parent2_scanned_at: new Date() };
    
    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .or(`parent1_name.eq.${parentName},parent2_name.eq.${parentName}`);
    
    if (updateError) throw updateError;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check QR status
app.post('/api/check-qr-status', async (req, res) => {
  try {
    const { parentName } = req.body;
    
    const { data, error } = await supabase
      .from('registrations')
      .select('parent1_name, parent2_name, parent1_scanned, parent2_scanned, parent1_scanned_at, parent2_scanned_at')
      .or(`parent1_name.eq.${parentName},parent2_name.eq.${parentName}`)
      .single();
    
    if (error) {
      return res.status(404).json({ error: "QR code not found" });
    }
    
    const isParent1 = data.parent1_name === parentName;
    
    res.json({
      scanned: isParent1 ? data.parent1_scanned : data.parent2_scanned,
      scannedAt: isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email
app.post('/api/send-qr-email', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(500).json({ error: "Email service not configured" });
    }
    
    const { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 } = req.body;
    
    let htmlContent = `
      <h2>LCC Graduation Reservation QR Codes</h2>
      <p>Dear ${studentName},</p>
      <p>Thank you for registering for the LCC Graduation Ceremony. Please find your QR codes below:</p>
      <h3>${parent1}'s QR Code:</h3>
      <img src="${qrDataParent1}" alt="QR Code for ${parent1}" style="margin: 20px 0;" />
    `;
    
    if (qrDataParent2) {
      htmlContent += `
        <h3>${parent2}'s QR Code:</h3>
        <img src="${qrDataParent2}" alt="QR Code for ${parent2}" style="margin: 20px 0;" />
      `;
    }
    
    htmlContent += `
      <p><strong>Important:</strong> These QR codes are for one-time use only. Please do not share them with others.</p>
      <p>Present these QR codes at the graduation venue for entry.</p>
      <br />
      <p>Best regards,</p>
      <p>LCC Graduation Committee</p>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your LCC Graduation Reservation QR Codes',
      html: htmlContent
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Vercel
module.exports = app;