const { createClient } = require('@supabase/supabase-js');

let supabase = null;

try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
} catch (err) {
  console.error('Supabase init error:', err.message);
}

module.exports = supabase;