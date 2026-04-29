const { Router } = require('express');
const supabase = require('../lib/supabase');

const router = Router();

router.get('/', (_req, res) => {
  const user      = (process.env.EMAIL_USER  || '').trim();
  const pass      = (process.env.EMAIL_PASS  || '').trim().replace(/\s+/g, '');
  const eventDate = process.env.EVENT_DATE   || null;

  // Compute what isBeforeEventDate() would return right now
  let beforeEvent = true;
  let eventParsed = null;
  if (eventDate) {
    try {
      eventParsed = new Date(eventDate + 'T00:00:00+08:00').toISOString();
      beforeEvent = new Date() < new Date(eventDate + 'T00:00:00+08:00');
    } catch (e) {
      eventParsed = 'PARSE ERROR: ' + e.message;
    }
  }

  res.json({
    status:    'OK',
    timestamp: new Date().toISOString(),
    supabase:  !!supabase,
    env: {
      SUPABASE_URL:      !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      EMAIL_USER:        !!user,
      EMAIL_PASS:        !!pass,
      EMAIL_PASS_LENGTH: pass.length,
      EMAIL_USER_HINT:   user ? user.slice(0, 4) + '****' : 'not set',
      EVENT_DATE:        eventDate  || 'not set',
      EVENT_DATE_PARSED: eventParsed || 'not set',
      BEFORE_EVENT:      beforeEvent,      // if false → one-time use is enforced RIGHT NOW
      SERVER_TIME_PH:    new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    }
  });
});

module.exports = router;