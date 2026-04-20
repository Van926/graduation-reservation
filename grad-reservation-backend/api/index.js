const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();

// EXTREMELY IMPORTANT: CORS must be configured before any routes
// Allow all origins for testing (you can restrict later)
app.use((req, res, next) => {
  // Allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow specific methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // Allow specific headers
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Allow credentials if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request for:', req.url);
    return res.status(200).end();
  }
  
  next();
});

// Also use cors middleware as backup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Parse JSON
app.use(express.json({ limit: '10mb' }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Initialize Supabase
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    console.log('Supabase initialized');
  }
} catch (error) {
  console.error('Supabase init error:', error.message);
}

// Initialize Email
let transporter = null;
try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('Email initialized');
  }
} catch (error) {
  console.error('Email init error:', error.message);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'API is running',
    endpoints: [
      'GET /api/health',
      'POST /api/check-student-number',
      'POST /api/save-registration',
      'POST /api/scan-qr',
      'POST /api/check-qr-status',
      'POST /api/send-qr-email'
    ]
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    supabase: !!supabase,
    email: !!transporter,
    cors: 'Enabled'
  });
});

// Check student number
app.post('/api/check-student-number', async (req, res) => {
  console.log('Received check-student-number request:', req.body);
  
  try {
    if (!supabase) {
      return res.json({ exists: false });
    }
    
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
  console.log('Received save-registration request');
  
  try {
    if (!supabase) {
      return res.json({ success: true });
    }
    
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
    
    const { error } = await supabase
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

// Scan QR
app.post('/api/scan-qr', async (req, res) => {
  console.log('Received scan-qr request:', req.body);
  
  try {
    if (!supabase) {
      return res.json({ success: true });
    }
    
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
  console.log('Received check-qr-status request:', req.body);
  
  try {
    if (!supabase) {
      return res.json({ scanned: false });
    }
    
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
  console.log('Received send-qr-email request');
  
  try {
    if (!transporter) {
      return res.json({ success: true, mock: true });
    }
    
    const { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 } = req.body;
    
    let htmlContent = `
      <h2>LCC Graduation Reservation QR Codes</h2>
      <p>Dear ${studentName},</p>
      <p>Thank you for registering for the LCC Graduation Ceremony.</p>
      <h3>${parent1}'s QR Code:</h3>
      <img src="${qrDataParent1}" alt="QR Code" style="max-width: 200px;" />
    `;
    
    if (qrDataParent2) {
      htmlContent += `
        <h3>${parent2}'s QR Code:</h3>
        <img src="${qrDataParent2}" alt="QR Code" style="max-width: 200px;" />
      `;
    }
    
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

// Catch all 404
app.use('*', (req, res) => {
  console.log('404 for:', req.method, req.url);
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.url,
    method: req.method
  });
});

module.exports = app;