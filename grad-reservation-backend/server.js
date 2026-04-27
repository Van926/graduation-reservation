const express = require('express');

const healthRoutes       = require('./routes/health');
const registrationRoutes = require('./routes/registration');
const qrRoutes           = require('./routes/qr');
const emailRoutes        = require('./routes/email');
const scanRoutes          = require('./routes/scan');
const registrationsRoutes = require('./routes/registrations');

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(express.json({ limit: '10mb' }));

// ─── Index ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    message: 'API is running',
    endpoints: [
      'GET  /api/health',
      'GET  /scan?parent=<parentName>',
      'POST /api/check-student-number',
      'POST /api/save-registration',
      'POST /api/scan-qr',
      'POST /api/check-qr-status',
      'POST /api/send-qr-email',
      'GET  /api/registrations?filter=all|scanned|unscanned'
    ]
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api',        registrationRoutes);
app.use('/api',        qrRoutes);
app.use('/api',        emailRoutes);
app.use('/scan',          scanRoutes);
app.use('/api',          registrationsRoutes);

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.url, method: req.method });
});

module.exports = app;