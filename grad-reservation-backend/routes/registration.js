const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

// Reusable helper — returns the student row or null (never throws on 0 rows)
async function findStudent(studentNumber) {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('student_number', studentNumber)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// POST /api/check-student-number - Returns ALL registration data
router.post('/check-student-number', async (req, res) => {
  if (!supabase) return res.json({ exists: false });

  try {
    const { studentNumber } = req.body;
    console.log('Checking student number:', studentNumber); // Debug log
    
    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    const student = await findStudent(studentNumber);
    console.log('Found student:', student); // Debug log
    
    if (student) {
      // Return all student data including parent names
      res.json({
        exists: true,
        student_name: student.student_name || '',
        student_number: student.student_number || '',
        course: student.course || '',
        email: student.email || '',
        contact_number: student.contact_number || '',
        parent1_name: student.parent1_name || '',
        parent2_name: student.parent2_name || '',
        parent1_scanned: student.parent1_scanned || false,
        parent2_scanned: student.parent2_scanned || false,
      });
    } else {
      res.json({ exists: false });
    }
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

    console.log('Saving registration for:', studentNumber); // Debug log
    console.log('Parent1:', parent1, 'Parent2:', parent2); // Debug log

    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    // Check if student exists
    const existing = await findStudent(studentNumber);
    
    let error;
    
    if (existing) {
      // UPDATE existing record
      console.log('Updating existing record for:', studentNumber);
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          student_name:    studentName,
          course:          course,
          email:           email,
          contact_number:  contactNumber,
          parent1_name:    parent1,
          parent2_name:    parent2 || null,
          qr_code_parent1: qrCodeParent1,
          qr_code_parent2: qrCodeParent2 || null,
        })
        .eq('student_number', studentNumber);
      
      error = updateError;
    } else {
      // INSERT new record
      console.log('Creating new record for:', studentNumber);
      const { error: insertError } = await supabase
        .from('registrations')
        .insert([{
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
          created_at:      new Date().toISOString()
        }]);
      
      error = insertError;
    }

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    res.json({ success: true, isUpdate: !!existing });
  } catch (err) {
    console.error('save-registration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/update-registration - Update parent names, email, contact
router.put('/update-registration', async (req, res) => {
  if (!supabase) return res.json({ success: true });

  try {
    const {
      studentNumber,
      email,
      contactNumber,
      parent1,
      parent2,
      qrCodeParent1,
      qrCodeParent2,
    } = req.body;

    console.log('Updating registration for:', studentNumber);
    console.log('New parent1:', parent1, 'New parent2:', parent2);

    if (!studentNumber) return res.status(400).json({ error: 'Student number is required.' });

    // Check if student exists
    const existing = await findStudent(studentNumber);
    if (!existing) return res.status(404).json({ error: 'Registration not found.' });

    // UPDATE existing record
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        email:           email,
        contact_number:  contactNumber,
        parent1_name:    parent1,
        parent2_name:    parent2 || null,
        qr_code_parent1: qrCodeParent1,
        qr_code_parent2: qrCodeParent2 || null,
        parent1_scanned: false,
        parent2_scanned: false
      })
      .eq('student_number', studentNumber);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('update-registration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;