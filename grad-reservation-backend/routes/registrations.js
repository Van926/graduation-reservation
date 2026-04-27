const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// GET /api/registrations
// Returns all registrations with parent scan status, optionally filtered by status
// Query params: ?filter=all|scanned|unscanned (default: all)
router.get('/registrations', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database not configured.' });

  try {
    const { data, error } = await supabase
      .from('registrations')
      .select(`
        id,
        student_name,
        student_number,
        course,
        email,
        contact_number,
        parent1_name,
        parent2_name,
        parent1_scanned,
        parent2_scanned,
        parent1_scanned_at,
        parent2_scanned_at,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten into one row per parent for easier display and export
    const rows = [];
    for (const reg of data) {
      rows.push({
        student_name:    reg.student_name,
        student_number:  reg.student_number,
        course:          reg.course,
        email:           reg.email,
        contact_number:  reg.contact_number,
        parent_name:     reg.parent1_name,
        parent_slot:     'Parent 1',
        scanned:         reg.parent1_scanned,
        scanned_at:      reg.parent1_scanned_at || null,
        registered_at:   reg.created_at,
      });

      if (reg.parent2_name) {
        rows.push({
          student_name:    reg.student_name,
          student_number:  reg.student_number,
          course:          reg.course,
          email:           reg.email,
          contact_number:  reg.contact_number,
          parent_name:     reg.parent2_name,
          parent_slot:     'Parent 2',
          scanned:         reg.parent2_scanned,
          scanned_at:      reg.parent2_scanned_at || null,
          registered_at:   reg.created_at,
        });
      }
    }

    // Optional filter
    const filter = req.query.filter || 'all';
    const filtered =
      filter === 'scanned'   ? rows.filter(r => r.scanned) :
      filter === 'unscanned' ? rows.filter(r => !r.scanned) :
      rows;

    res.json({ success: true, total: filtered.length, data: filtered });
  } catch (err) {
    console.error('registrations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;