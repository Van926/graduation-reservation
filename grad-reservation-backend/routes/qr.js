const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

function getEventDate() {
  return process.env.EVENT_DATE || null;
}

/**
 * Returns true if scanning should be unlimited (event hasn't happened yet or no date set).
 * On and after the event date, QR codes become one-time use.
 */
function isBeforeEventDate() {
  const eventDate = getEventDate();
  if (!eventDate) return true; // no date set — unlimited scanning always
  const now       = new Date();
  const event     = new Date(eventDate + "T00:00:00+08:00"); // Philippine time
  return now < event;
}

async function findByParentName(parentName) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, parent1_name, parent2_name, parent1_scanned, parent2_scanned, parent1_scanned_at, parent2_scanned_at')
    .or(`parent1_name.eq."${parentName}",parent2_name.eq."${parentName}"`)
    .single();
  return { data, error };
}

// POST /api/scan-qr
router.post('/scan-qr', async (req, res) => {
  if (!supabase) return res.json({ success: true });

  try {
    const { parentName } = req.body;
    if (!parentName) return res.status(400).json({ error: 'Parent name is required.' });

    const { data, error } = await findByParentName(parentName);
    if (error || !data) {
      return res.status(404).json({ error: 'QR code not found. No matching registration.' });
    }

    const isParent1   = data.parent1_name === parentName;
    const scanned     = isParent1 ? data.parent1_scanned     : data.parent2_scanned;
    const scannedAt   = isParent1 ? data.parent1_scanned_at  : data.parent2_scanned_at;
    const beforeEvent = isBeforeEventDate();

    // Before event date: allow unlimited re-scanning — just update the timestamp
    // On/after event date: one-time use — reject if already scanned
    if (scanned && !beforeEvent) {
      return res.json({ inactive: true, scannedAt });
    }

    // Record the scan (new, re-scan, or test scan)
    const now        = new Date().toISOString();
    const isTestScan = !scanned && beforeEvent; // first-time scan before event date

    // For test scans: reset scanned back to false so the QR remains "unused"
    // until the actual event day. For real/re-scans: mark as scanned normally.
    const updateData = isParent1
      ? { parent1_scanned: !isTestScan, parent1_scanned_at: isTestScan ? null : now }
      : { parent2_scanned: !isTestScan, parent2_scanned_at: isTestScan ? null : now };

    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', data.id);

    if (updateError) throw updateError;

    res.json({
      success:     true,
      rescan:      scanned && beforeEvent,  // true = this was a re-scan before the event
      beforeEvent: isTestScan,              // true = first-time scan before event date
      scannedAt:   now,
      eventDate:   getEventDate(),
    });
  } catch (err) {
    console.error('scan-qr error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/check-qr-status
router.post('/check-qr-status', async (req, res) => {
  if (!supabase) return res.json({ scanned: false });

  try {
    const { parentName } = req.body;
    if (!parentName) return res.status(400).json({ error: 'Parent name is required.' });

    const { data, error } = await findByParentName(parentName);
    if (error || !data) {
      return res.status(404).json({ error: 'QR code not found. No matching registration.' });
    }

    const isParent1   = data.parent1_name === parentName;
    const beforeEvent = isBeforeEventDate();
    res.json({
      scanned:      isParent1 ? data.parent1_scanned   : data.parent2_scanned,
      scannedAt:    isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at,
      beforeEvent,
      eventDate:    getEventDate(),
      mode:         beforeEvent ? 'unlimited' : 'one-time',
    });
  } catch (err) {
    console.error('check-qr-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mark-scanned
router.post('/mark-scanned', async (req, res) => {
  if (!supabase) return res.json({ success: true });

  try {
    const { parentName, studentNumber } = req.body;
    if (!parentName)    return res.status(400).json({ error: 'Parent name is required.' });
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    const { data, error } = await supabase
      .from('registrations')
      .select('id, parent1_name, parent2_name, parent1_scanned, parent2_scanned')
      .eq('student_number', studentNumber)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Registration not found.' });

    const isParent1 = data.parent1_name === parentName;
    const isParent2 = data.parent2_name === parentName;
    if (!isParent1 && !isParent2) {
      return res.status(404).json({ error: 'Parent name does not match this registration.' });
    }

    const alreadyScanned = isParent1 ? data.parent1_scanned : data.parent2_scanned;
    if (alreadyScanned && !isBeforeEventDate()) {
      return res.status(409).json({ error: 'This QR code is already marked as scanned.' });
    }

    const now        = new Date().toISOString();
    const updateData = isParent1
      ? { parent1_scanned: true, parent1_scanned_at: now }
      : { parent2_scanned: true, parent2_scanned_at: now };

    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', data.id);

    if (updateError) throw updateError;

    res.json({ success: true, scanned_at: now });
  } catch (err) {
    console.error('mark-scanned error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/event-date — returns the configured event date
router.get('/event-date', (_req, res) => {
  res.json({ eventDate: getEventDate() });
});

module.exports = router;