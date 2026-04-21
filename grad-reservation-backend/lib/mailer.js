const nodemailer = require('nodemailer');

async function getTransporter() {
  // Trim whitespace — catches App Passwords copied with spaces (xxxx xxxx xxxx xxxx)
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

  if (!user) throw new Error('EMAIL_USER is not set or is empty.');
  if (!pass) throw new Error('EMAIL_PASS is not set or is empty.');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  await transporter.verify();
  return transporter;
}

module.exports = { getTransporter };