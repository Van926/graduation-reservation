const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// Reusable helper — returns the student row or null (never throws on 0 rows)
async function findStudent(studentNumber) {
  const { data, error } = await supabase
    .from('registrations')
    .select('student_number, student_name, course')
    .eq('student_number', studentNumber)
    .maybeSingle();               // returns null (not an error) when no row found

  if (error) throw error;
  return data || null;            // null = not found
}

// POST /api/check-student-number
router.post('/check-student-number', async (req, res) => {
  if (!supabase) return res.json({ exists: false });

  try {
    const { studentNumber } = req.body;
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    const student = await findStudent(studentNumber);
    res.json({
      exists:       !!student,
      student_name: student?.student_name || null,
      course:       student?.course       || null,
    });
  } catch (err) {
    console.error('check-student-number error:', err.message);
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

    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    // Final server-side duplicate guard — catches race conditions where two
    // requests arrive before either has finished inserting
    const existing = await findStudent(studentNumber);
    if (existing) {
      return res.status(409).json({
        error: 'This student number is already registered.',
        duplicate: true
      });
    }

    const { error } = await supabase.from('registrations').insert([{
      student_name:    studentName,
      student_number:  studentNumber,
      course,
      email,
      contact_number:  contactNumber,
      parent1_name:    parent1,
      parent2_name:    parent2 || null,
      qr_code_parent1: qrCodeParent1,
      qr_code_parent2: qrCodeParent2 || null,
      parent1_scanned: false,
      parent2_scanned: false
    }]);

    if (error) {
      // Catch Supabase unique constraint violation as a last resort
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'This student number is already registered.',
          duplicate: true
        });
      }
      throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('save-registration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;