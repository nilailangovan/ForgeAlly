const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'forgeally_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper to generate a 6-digit random numeric OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ----------------------------------------------------
// SMS Helper — tries Fast2SMS → Twilio → console mock
// ----------------------------------------------------
async function sendSMS(toPhone, otpCode) {
  const messageText = `Your ForgeAlly OTP is: ${otpCode}. Valid for 5 minutes.`;

  // Strip country code for Fast2SMS (it expects 10-digit Indian numbers)
  const indianNumber = toPhone.replace(/^\+91/, '').replace(/\D/g, '');

  // ── 1. Try Fast2SMS (best for Indian numbers) ─────────────────
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && fast2smsKey !== 'your_fast2sms_key') {
    try {
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: fast2smsKey,
          variables_values: otpCode,
          route: 'otp',
          numbers: indianNumber,
        },
        timeout: 8000,
      });

      if (response.data && response.data.return === true) {
        console.log(`✅ Fast2SMS OTP sent to ${toPhone}`);
        return { success: true, provider: 'fast2sms' };
      } else {
        console.warn('Fast2SMS response error:', response.data);
      }
    } catch (err) {
      console.error('Fast2SMS failed:', err.response?.data?.message || err.message);
    }
  }

  // ── 2. Try Twilio as backup ───────────────────────────────────
  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.TWILIO_PHONE_NUMBER;
  const twilioReady = twilioSid && twilioSid !== 'your_sid' &&
                      twilioToken && twilioToken !== 'your_token' &&
                      twilioFrom && twilioFrom !== 'your_twilio_number';

  if (twilioReady) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        new URLSearchParams({ Body: messageText, From: twilioFrom, To: toPhone }),
        { headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
      );
      console.log(`✅ Twilio SMS sent to ${toPhone}`);
      return { success: true, provider: 'twilio' };
    } catch (err) {
      console.error('Twilio failed:', err.response?.data?.message || err.message);
    }
  }

  // ── 3. Mock fallback (dev mode) ──────────────────────────────
  console.log('\n--- [MOCK SMS GATEWAY — Configure FAST2SMS_API_KEY in .env to send real SMS] ---');
  console.log(`To: ${toPhone}`);
  console.log(`Message: ${messageText}`);
  console.log('--------------------------------------------------------------------------------\n');
  return { success: true, mocked: true };
}


// ----------------------------------------------------
// 1. REGISTRATION API
// ----------------------------------------------------
app.post('/api/register', async (req, res) => {
  const { username, email, password, phone } = req.body;

  // Validate fields
  if (!username || !email || !password || !phone) {
    return res.status(400).json({ error: 'All fields (username, email, password, phone) are required.' });
  }

  try {
    // Check if email or phone already exists
    const checkQuery = 'SELECT id, email, phone FROM users WHERE email = $1 OR phone = $2';
    const checkResult = await db.query(checkQuery, [email.trim(), phone.trim()]);
    
    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      if (existing.email.toLowerCase() === email.trim().toLowerCase()) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
      if (existing.phone === phone.trim()) {
        return res.status(409).json({ error: 'Phone number already registered.' });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, phone, is_verified)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING id, username, email, phone
    `;
    await db.query(insertQuery, [username.trim(), email.trim().toLowerCase(), passwordHash, phone.trim()]);

    return res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(500).json({ error: 'Database error occurred during registration.' });
  }
});

// ----------------------------------------------------
// 2. OTP API
// ----------------------------------------------------
app.post('/api/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    const otp = generateOTP();
    // Expiry: 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save/Insert OTP into otp_codes
    const insertOtpQuery = `
      INSERT INTO otp_codes (phone, otp, expires_at)
      VALUES ($1, $2, $3)
    `;
    await db.query(insertOtpQuery, [phone.trim(), otp, expiresAt]);

    // Send SMS
    const result = await sendSMS(phone.trim(), otp);

    return res.status(200).json({ 
      message: 'OTP sent successfully',
      ...(result.mocked ? { otp: otp, dev_note: 'OTP was logged to console since Twilio credentials are not set.' } : {})
    });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    return res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP code are required.' });
  }

  try {
    // Find matching OTP that is not expired
    const otpQuery = `
      SELECT * FROM otp_codes 
      WHERE phone = $1 AND otp = $2 AND expires_at > NOW() 
      ORDER BY expires_at DESC LIMIT 1
    `;
    const otpResult = await db.query(otpQuery, [phone.trim(), otp.trim()]);

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // OTP is valid!
    // 1. Update user to is_verified = true
    const updateQuery = `
      UPDATE users SET is_verified = TRUE 
      WHERE phone = $1 
      RETURNING id, username, email, phone
    `;
    const userResult = await db.query(updateQuery, [phone.trim()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User associated with this phone number was not found.' });
    }

    const verifiedUser = userResult.rows[0];

    // 2. Delete verification OTP code record
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone.trim()]);

    // 3. Generate JWT (expires in 7 days)
    const token = jwt.sign(
      { id: verifiedUser.id, username: verifiedUser.username, email: verifiedUser.email, phone: verifiedUser.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        id: verifiedUser.id,
        username: verifiedUser.username,
        email: verifiedUser.email,
        phone: verifiedUser.phone
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    return res.status(500).json({ error: 'Error validating OTP.' });
  }
});

// ----------------------------------------------------
// 3. LOGIN API
// ----------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body; // Accept email or username in "username" field

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    // Find user by username or email
    const findQuery = 'SELECT * FROM users WHERE username = $1 OR email = $1';
    const userResult = await db.query(findQuery, [username.trim()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = userResult.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        is_verified: user.is_verified
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/login-phone', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    // Check if user exists
    const findQuery = 'SELECT id FROM users WHERE phone = $1';
    const userResult = await db.query(findQuery, [phone.trim()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this phone number. Please register first.' });
    }

    // Generate and send OTP (re-use /api/send-otp flow logic inline)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save/Insert OTP into db
    const insertOtpQuery = 'INSERT INTO otp_codes (phone, otp, expires_at) VALUES ($1, $2, $3)';
    await db.query(insertOtpQuery, [phone.trim(), otp, expiresAt]);

    // Send SMS
    const result = await sendSMS(phone.trim(), otp);

    return res.status(200).json({
      message: 'OTP sent to phone',
      ...(result.mocked ? { otp: otp, dev_note: 'OTP was logged to console since Twilio credentials are not set.' } : {})
    });
  } catch (err) {
    console.error('Login phone error:', err.message);
    return res.status(500).json({ error: 'Server error sending verification code.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ForgeAlly server running on port ${PORT}`);
});
