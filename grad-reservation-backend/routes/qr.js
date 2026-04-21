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