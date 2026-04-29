const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// Reusable helper — returns the full student row or null
async function findStudent(studentNumber) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, student_number, student_name, course, email, contact_number, parent1_name, parent2_name')
    .eq('student_number', studentNumber)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// POST /api/check-student-number
router.post('/check-student-number', async (req, res) => {
  if (!supabase) return res.json({ exists: false });
  try {
    const { studentNumber } = req.body;
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    const student = await findStudent(studentNumber);
    res.json({
      exists:          !!student,
      student_name:    student?.student_name    || null,
      course:          student?.course          || null,
      email:           student?.email           || null,
      contact_number:  student?.contact_number  || null,
      parent1_name:    student?.parent1_name    || null,
      parent2_name:    student?.parent2_name    || null,
      has_registration: !!(student?.parent1_name),
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
    const { studentName, studentNumber, course, email, contactNumber, parent1, parent2, qrCodeParent1, qrCodeParent2 } = req.body;
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    const existing = await findStudent(studentNumber);
    if (existing && existing.parent1_name) {
      return res.status(409).json({ error: 'This student number already has a registration.', duplicate: true });
    }

    // Upsert — update existing row if imported (no parents yet) or insert fresh
    if (existing) {
      const { error } = await supabase
        .from('registrations')
        .update({
          email,
          contact_number:  contactNumber,
          parent1_name:    parent1,
          parent2_name:    parent2 || null,
          qr_code_parent1: qrCodeParent1,
          qr_code_parent2: qrCodeParent2 || null,
          parent1_scanned: false,
          parent2_scanned: false,
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
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
        parent2_scanned: false,
      }]);
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'This student number is already registered.', duplicate: true });
        throw error;
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('save-registration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/update-registration
// Deletes the existing parents/QR and saves new ones — preserves student info
router.put('/update-registration', async (req, res) => {
  if (!supabase) return res.json({ success: true });
  try {
    const { studentNumber, email, contactNumber, parent1, parent2, qrCodeParent1, qrCodeParent2 } = req.body;
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });
    if (!parent1)       return res.status(400).json({ error: 'Parent 1 name is required.' });

    const existing = await findStudent(studentNumber);
    if (!existing) return res.status(404).json({ error: 'Registration not found.' });

    const { error } = await supabase
      .from('registrations')
      .update({
        email:           email          || existing.email,
        contact_number:  contactNumber  || existing.contact_number,
        parent1_name:    parent1,
        parent2_name:    parent2        || null,
        qr_code_parent1: qrCodeParent1,
        qr_code_parent2: qrCodeParent2  || null,
        parent1_scanned: false,
        parent2_scanned: false,
        parent1_scanned_at: null,
        parent2_scanned_at: null,
      })
      .eq('id', existing.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('update-registration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;