const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

function isBeforeEventDate() {
  const eventDate = process.env.EVENT_DATE || null;
  if (!eventDate) return true;
  const now   = new Date();
  const event = new Date(eventDate + 'T00:00:00+08:00');
  return now < event;
}


/**
 * GET /scan?parent=Juan+Santos
 * Landing page opened when a phone scans the QR code.
 * Marks the QR as scanned and renders a result screen — no JSON, full HTML.
 */
async function handleScan(req, res) {
  const parentName = (req.query.parent || '').trim();

  if (!parentName) {
    return res.status(400).send(renderPage({
      status: 'error',
      title: 'Invalid QR Code',
      message: 'This QR code is missing the required information. Please contact the registration desk.',
      color: '#ef4444'
    }));
  }

  if (!supabase) {
    return res.send(renderPage({
      status: 'error',
      title: 'System Unavailable',
      message: 'The registration system is currently unavailable. Please try again or contact the registration desk.',
      color: '#ef4444'
    }));
  }

  try {
    // Find the registration row
    const { data, error } = await supabase
      .from('registrations')
      .select('id, student_name, course, parent1_name, parent2_name, parent1_scanned, parent2_scanned, parent1_scanned_at, parent2_scanned_at')
      .or(`parent1_name.eq."${parentName}",parent2_name.eq."${parentName}"`)
      .single();

    if (error || !data) {
      return res.status(404).send(renderPage({
        status: 'error',
        title: 'QR Code Not Found',
        message: 'This QR code does not match any registration. Please contact the registration desk.',
        color: '#ef4444'
      }));
    }

    const isParent1      = data.parent1_name === parentName;
    const alreadyScanned = isParent1 ? data.parent1_scanned    : data.parent2_scanned;
    const scannedAt      = isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at;
    const beforeEvent    = isBeforeEventDate();

    // After event date and already scanned — one-time use enforced
    if (alreadyScanned && !beforeEvent) {
      const when = scannedAt
        ? new Date(scannedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
        : 'earlier';

      return res.send(renderPage({
        status: 'inactive',
        title: 'QR Code Already Used',
        message: `This QR code was already scanned on ${when}. Each code is valid for one entry only.`,
        parentName,
        studentName: data.student_name,
        course: data.course,
        color: '#f59e0b'
      }));
    }

    // Record the scan (new scan, re-scan, or test scan before event date)
    const now         = new Date().toISOString();
    const isTestScan  = !alreadyScanned && beforeEvent; // first-time scan before event date

    // For test scans: reset scanned back to false so the QR stays "unused"
    // until the actual event day. For real/re-scans: mark as scanned normally.
    const updateField = isParent1
      ? { parent1_scanned: !isTestScan, parent1_scanned_at: isTestScan ? null : now }
      : { parent2_scanned: !isTestScan, parent2_scanned_at: isTestScan ? null : now };

    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateField)
      .eq('id', data.id);

    if (updateError) throw updateError;

    // Re-scan before event date
    if (alreadyScanned && beforeEvent) {
      const when = scannedAt
        ? new Date(scannedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
        : 'earlier';

      return res.send(renderPage({
        status: 'rescan',
        title: 'Re-entry Verified',
        message: `QR code verified. This guest has been checked in again.`,
        detail: `Previously scanned: ${when}`,
        parentName,
        studentName: data.student_name,
        course: data.course,
        color: '#6366f1'
      }));
    }

    // First-time scan before event date — test scan
    if (beforeEvent) {
      return res.send(renderPage({
        status: 'test',
        title: 'Test Scan',
        message: `QR code is valid. This is a test scan — the event has not started yet.`,
        parentName,
        studentName: data.student_name,
        course: data.course,
        color: '#06b6d4'
      }));
    }

    return res.send(renderPage({
      status: 'success',
      title: 'Entry Approved',
      message: `Welcome! You have been successfully checked in for the LCC Graduation Ceremony.`,
      parentName,
      studentName: data.student_name,
      course: data.course,
      color: '#22c55e'
    }));

  } catch (err) {
    console.error('scan error:', err.message);
    return res.status(500).send(renderPage({
      status: 'error',
      title: 'System Error',
      message: 'Something went wrong. Please show this QR code to the registration desk.',
      color: '#ef4444'
    }));
  }
}

// ─── HTML renderer ────────────────────────────────────────────────────────────
function renderPage({ status, title, message, detail, parentName, studentName, course, color }) {
  const icons = {
    success:  '✓',
    test:     '⚡',
    rescan:   '↻',
    inactive: '⚠',
    error:    '✕'
  };

  const icon = icons[status] || '?';

  const detailsHtml = (parentName && studentName) ? `
    <div class="details">
      <div class="detail-row"><span class="label">Parent</span><span class="value">${escHtml(parentName)}</span></div>
      <div class="detail-row"><span class="label">Student</span><span class="value">${escHtml(studentName)}</span></div>
      ${course ? `<div class="detail-row"><span class="label">Course</span><span class="value">${escHtml(course)}</span></div>` : ''}
      ${detail ? `<div class="detail-row"><span class="label">Note</span><span class="value">${escHtml(detail)}</span></div>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCC Graduation — QR Scan</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f13;
      font-family: 'DM Sans', sans-serif;
      padding: 24px;
    }

    .card {
      background: #1a1a22;
      border: 1px solid #2a2a35;
      border-radius: 20px;
      padding: 48px 36px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .icon-ring {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: ${color}18;
      border: 2px solid ${color}40;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      font-size: 36px;
      color: ${color};
      animation: pop 0.4s 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes pop {
      from { opacity: 0; transform: scale(0.6); }
      to   { opacity: 1; transform: scale(1); }
    }

    .event-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #555566;
      margin-bottom: 12px;
    }

    h1 {
      font-family: 'DM Serif Display', serif;
      font-size: 28px;
      color: #f0f0f8;
      margin-bottom: 14px;
      line-height: 1.2;
    }

    .message {
      font-size: 15px;
      color: #888899;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .details {
      background: #12121a;
      border: 1px solid #22222e;
      border-radius: 12px;
      padding: 20px;
      text-align: left;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .detail-row + .detail-row {
      border-top: 1px solid #1e1e28;
    }

    .label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #44445a;
    }

    .value {
      font-size: 14px;
      font-weight: 500;
      color: #c8c8de;
      text-align: right;
    }

    .status-bar {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #1e1e28;
      font-size: 12px;
      color: #33334a;
    }

    .dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${color};
      margin-right: 6px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-ring">${icon}</div>
    <p class="event-label">LCC Graduation Ceremony</p>
    <h1>${escHtml(title)}</h1>
    <p class="message">${escHtml(message)}</p>
    ${detailsHtml}
    <div class="status-bar">
      <span class="dot"></span>
      ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
    </div>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Register on both paths — handles Vercel stripping /scan prefix in some configs
router.get('/scan', handleScan);
router.get('/',     handleScan);

module.exports = router;