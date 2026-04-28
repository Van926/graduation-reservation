const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// GET /api/registrations?filter=all|scanned|unscanned
router.get('/registrations', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database not configured.' });
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('id,student_name,student_number,course,email,contact_number,parent1_name,parent2_name,parent1_scanned,parent2_scanned,parent1_scanned_at,parent2_scanned_at,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = [];
    for (const reg of data) {
      rows.push({ student_name: reg.student_name, student_number: reg.student_number, course: reg.course, email: reg.email, contact_number: reg.contact_number, parent_name: reg.parent1_name, parent_slot: 'Parent 1', scanned: reg.parent1_scanned, scanned_at: reg.parent1_scanned_at || null, registered_at: reg.created_at });
      if (reg.parent2_name) rows.push({ student_name: reg.student_name, student_number: reg.student_number, course: reg.course, email: reg.email, contact_number: reg.contact_number, parent_name: reg.parent2_name, parent_slot: 'Parent 2', scanned: reg.parent2_scanned, scanned_at: reg.parent2_scanned_at || null, registered_at: reg.created_at });
    }

    const filter = req.query.filter || 'all';
    const filtered = filter === 'scanned' ? rows.filter(r => r.scanned) : filter === 'unscanned' ? rows.filter(r => !r.scanned) : rows;
    res.json({ success: true, total: filtered.length, data: filtered });
  } catch (err) {
    console.error('registrations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import-students
// Body: { students: [{ student_name, student_number, course }] }
// Skips duplicates, returns counts of imported vs skipped
router.post('/import-students', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database not configured.' });
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'No student data provided.' });
    }

    // Validate each row has required fields
    const invalid = students.filter(s => !s.student_name || !s.student_number || !s.course);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `${invalid.length} row(s) are missing student_name, student_number, or course.` });
    }

    // Fetch existing student numbers to detect duplicates
    const numbers = students.map(s => String(s.student_number));
    const { data: existing, error: fetchError } = await supabase
      .from('registrations')
      .select('student_number')
      .in('student_number', numbers);
    if (fetchError) throw fetchError;

    const existingSet = new Set((existing || []).map(r => String(r.student_number)));
    const toInsert = students.filter(s => !existingSet.has(String(s.student_number)));
    const skipped  = students.length - toInsert.length;

    if (toInsert.length > 0) {
      const rows = toInsert.map(s => ({
        student_name:    String(s.student_name).trim(),
        student_number:  String(s.student_number).trim(),
        course:          String(s.course).trim(),
        email:           s.email ? String(s.email).trim() : null,
        contact_number:  s.contact_number ? String(s.contact_number).trim() : null,
        parent1_name:    null,
        parent2_name:    null,
        qr_code_parent1: null,
        qr_code_parent2: null,
        parent1_scanned: false,
        parent2_scanned: false,
      }));

      const { error: insertError } = await supabase.from('registrations').insert(rows);
      if (insertError) throw insertError;
    }

    res.json({ success: true, imported: toInsert.length, skipped, total: students.length });
  } catch (err) {
    console.error('import-students error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;