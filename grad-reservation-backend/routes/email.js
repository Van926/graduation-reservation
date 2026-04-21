const { Router } = require('express');
const { getTransporter } = require('../lib/mailer');

const router = Router();

// POST /api/send-qr-email
router.post('/send-qr-email', async (req, res) => {
  try {
    const { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 } = req.body;

    // Validate required fields before attempting to send
    if (!email)         return res.status(400).json({ error: 'Recipient email is required.' });
    if (!studentName)   return res.status(400).json({ error: 'Student name is required.' });
    if (!parent1)       return res.status(400).json({ error: 'At least one parent name is required.' });
    if (!qrDataParent1) return res.status(400).json({ error: 'QR code data for parent 1 is required.' });

    // Build HTML — base64 QR images are embedded inline
    let html = `
      <h2>LCC Graduation Reservation QR Codes</h2>
      <p>Dear ${studentName},</p>
      <p>Thank you for registering for the LCC Graduation Ceremony.</p>
      <h3>${parent1}'s QR Code:</h3>
      <img src="${qrDataParent1}" alt="${parent1} QR Code" style="max-width:200px;" />
    `;

    if (parent2 && qrDataParent2) {
      html += `
        <h3>${parent2}'s QR Code:</h3>
        <img src="${qrDataParent2}" alt="${parent2} QR Code" style="max-width:200px;" />
      `;
    }

    // getTransporter() verifies credentials — throws if misconfigured
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: `"LCC Graduation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your LCC Graduation Reservation QR Codes',
      html
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Email send error:', err.message);

    // Surface the real error to the caller instead of hiding it
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;