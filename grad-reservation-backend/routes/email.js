const { Router } = require('express');
const { getTransporter } = require('../lib/mailer');

const router = Router();

// POST /api/send-qr-email
router.post('/send-qr-email', async (req, res) => {
  try {
    const { studentName, email, parent1, parent2, qrDataParent1, qrDataParent2 } = req.body;

    if (!email)         return res.status(400).json({ error: 'Recipient email is required.' });
    if (!studentName)   return res.status(400).json({ error: 'Student name is required.' });
    if (!parent1)       return res.status(400).json({ error: 'At least one parent name is required.' });
    if (!qrDataParent1) return res.status(400).json({ error: 'QR code data for parent 1 is required.' });

    // ── Convert base64 data URLs to buffers for nodemailer attachments ─────────
    // data URLs look like: "data:image/png;base64,iVBORw0KGgo..."
    // We strip the prefix and decode the base64 into a raw buffer.
    const toBuffer = (dataUrl) => {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64, 'base64');
    };

    // ── Build attachments — cid: lets HTML reference them inline ──────────────
    const attachments = [
      {
        filename: `qr-${parent1.replace(/\s+/g, '-')}.png`,
        content:  toBuffer(qrDataParent1),
        cid:      'qr_parent1',           // referenced as cid:qr_parent1 in HTML
      }
    ];

    if (parent2 && qrDataParent2) {
      attachments.push({
        filename: `qr-${parent2.replace(/\s+/g, '-')}.png`,
        content:  toBuffer(qrDataParent2),
        cid:      'qr_parent2',
      });
    }

    // ── Build HTML — reference attachments via cid: not data: ─────────────────
    let html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1a1a22;">LCC Graduation Reservation QR Codes</h2>
        <p>Dear <strong>${studentName}</strong>,</p>
        <p>Thank you for registering for the LCC Graduation Ceremony. 
           Please present the QR code(s) below at the entrance on graduation day.</p>
        <p style="color:#ef4444;font-size:13px;">
          ⚠ Each QR code is valid for one entry only. Do not share these codes.
        </p>

        <table style="margin-top:24px;">
          <tr>
            <td style="padding:16px;text-align:center;background:#f9f9f9;border-radius:12px;">
              <p style="margin:0 0 8px;font-weight:bold;">${parent1}</p>
              <img src="cid:qr_parent1" alt="${parent1} QR Code"
                   width="200" height="200"
                   style="display:block;border:1px solid #eee;" />
            </td>
            ${parent2 && qrDataParent2 ? `
            <td style="width:24px;"></td>
            <td style="padding:16px;text-align:center;background:#f9f9f9;border-radius:12px;">
              <p style="margin:0 0 8px;font-weight:bold;">${parent2}</p>
              <img src="cid:qr_parent2" alt="${parent2} QR Code"
                   width="200" height="200"
                   style="display:block;border:1px solid #eee;" />
            </td>` : ''}
          </tr>
        </table>

        <p style="margin-top:32px;font-size:13px;color:#888;">
          This email was sent by the LCC Graduation Registration System.
        </p>
      </div>
    `;

    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from:        `"LCC Graduation" <${process.env.EMAIL_USER}>`,
      to:          email,
      subject:     'Your LCC Graduation Reservation QR Codes',
      html,
      attachments,
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;