const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

/**
 * Finds a registration row by parent name.
 * Values in .or() filters must be quoted to handle names with spaces or special chars.
 */
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

    const isParent1 = data.parent1_name === parentName;
    const scanned   = isParent1 ? data.parent1_scanned : data.parent2_scanned;

    if (scanned) {
      return res.json({
        inactive: true,
        scannedAt: isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at
      });
    }

    const updateData = isParent1
      ? { parent1_scanned: true, parent1_scanned_at: new Date().toISOString() }
      : { parent2_scanned: true, parent2_scanned_at: new Date().toISOString() };

    // Scope update to the exact row by id — avoids ambiguous multi-row updates
    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', data.id);

    if (updateError) throw updateError;

    res.json({ success: true });
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

    const isParent1 = data.parent1_name === parentName;

    res.json({
      scanned:   isParent1 ? data.parent1_scanned   : data.parent2_scanned,
      scannedAt: isParent1 ? data.parent1_scanned_at : data.parent2_scanned_at
    });
  } catch (err) {
    console.error('check-qr-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// POST /api/mark-scanned
// Manually marks a parent's QR as scanned from the admin panel
// Body: { parentName, studentNumber }
router.post('/mark-scanned', async (req, res) => {
  if (!supabase) return res.json({ success: true });

  try {
    const { parentName, studentNumber } = req.body;
    if (!parentName)     return res.status(400).json({ error: 'Parent name is required.' });
    if (!studentNumber)  return res.status(400).json({ error: 'Student number is required.' });

    // Fetch the exact row by student number for precision
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
    if (alreadyScanned) {
      return res.status(409).json({ error: 'This QR code is already marked as scanned.' });
    }

    const updateData = isParent1
      ? { parent1_scanned: true, parent1_scanned_at: new Date().toISOString() }
      : { parent2_scanned: true, parent2_scanned_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', data.id);

    if (updateError) throw updateError;

    res.json({ success: true, scanned_at: updateData.parent1_scanned_at || updateData.parent2_scanned_at });
  } catch (err) {
    console.error('mark-scanned error:', err.message);
    res.status(500).json({ error: err.message });
  }
});