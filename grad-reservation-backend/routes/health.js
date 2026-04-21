const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

router.get('/', (_req, res) => {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    supabase: !!supabase,
    env: {
      SUPABASE_URL:      !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      EMAIL_USER:        !!user,
      EMAIL_PASS:        !!pass,
      EMAIL_PASS_LENGTH: pass.length,   // lets you confirm the password length looks right
      EMAIL_USER_HINT:   user ? user.slice(0, 4) + '****' : 'not set'
    }
  });
});

module.exports = router;