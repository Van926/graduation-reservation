const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// POST /api/check-student-number
router.post('/check-student-number', async (req, res) => {
  if (!supabase) return res.json({ exists: false });

  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/save-registration
router.post('/save-registration', async (req, res) => {
  if (!supabase) return res.json({ success: true });

  try {
    const {
      studentName, studentNumber, course, email,
      contactNumber, parent1, parent2,
      qrCodeParent1, qrCodeParent2
    } = req.body;

    const { error } = await supabase.from('registrations').insert([{
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
    }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;