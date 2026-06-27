const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const twilio = require('twilio');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = require('./db');

// ── Twilio client (initialised lazily when credentials are present) ──────────
function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || sid === 'your_sid' || !token || token === 'your_token') return null;
  return twilio(sid, token);
}

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
// SMS Helper — tries Fast2SMS → Twilio Verify → Twilio SMS → console mock
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

  // ── 2a. Try Twilio Verify (recommended — handles OTP lifecycle) ──
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const client    = getTwilioClient();

  if (client && verifySid && verifySid !== 'your_verify_service_sid') {
    try {
      await client.verify.v2.services(verifySid)
        .verifications
        .create({ to: toPhone, channel: 'sms' });
      console.log(`✅ Twilio Verify OTP dispatched to ${toPhone}`);
      return { success: true, provider: 'twilio_verify' };
    } catch (err) {
      console.error('Twilio Verify failed:', err.message);
    }
  }

  // ── 2b. Try Twilio Programmable SMS (plain SMS fallback) ─────
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (client && twilioFrom && twilioFrom !== 'your_twilio_number') {
    try {
      await client.messages.create({
        body: messageText,
        from: twilioFrom,
        to:   toPhone,
      });
      console.log(`✅ Twilio SMS sent to ${toPhone}`);
      return { success: true, provider: 'twilio_sms' };
    } catch (err) {
      console.error('Twilio SMS failed:', err.message);
    }
  }

  // ── 3. Mock fallback (dev mode) ──────────────────────────────
  console.log('\n--- [MOCK SMS — add Twilio or Fast2SMS credentials to .env to send real OTPs] ---');
  console.log(`To: ${toPhone}`);
  console.log(`Message: ${messageText}`);
  console.log('-----------------------------------------------------------------------------------\n');
  return { success: true, mocked: true };
}

// ── Twilio Verify: check code (used when Verify API is active) ───────────────
async function verifyOtpWithTwilio(toPhone, code) {
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const client    = getTwilioClient();
  if (!client || !verifySid || verifySid === 'your_verify_service_sid') return null; // not configured

  try {
    const check = await client.verify.v2.services(verifySid)
      .verificationChecks
      .create({ to: toPhone, code });
    return check.status; // 'approved' | 'pending' | 'expired'
  } catch (err) {
    console.error('Twilio Verify check failed:', err.message);
    return null;
  }
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
    // ── Try Twilio Verify first (when configured) ─────────────
    const twilioStatus = await verifyOtpWithTwilio(phone.trim(), otp.trim());
    if (twilioStatus !== null) {
      // Twilio Verify is configured — trust its decision
      if (twilioStatus !== 'approved') {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
      }
      // Clean up any local DB OTP records for this phone (if any)
      await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone.trim()]);
    } else {
      // ── Fallback: check local DB OTP ───────────────────────
      const otpQuery = `
        SELECT * FROM otp_codes 
        WHERE phone = $1 AND otp = $2 AND expires_at > NOW() 
        ORDER BY expires_at DESC LIMIT 1
      `;
      const otpResult = await db.query(otpQuery, [phone.trim(), otp.trim()]);

      if (otpResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
      }

      // Delete used OTP
      await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone.trim()]);
    }

    // OTP is valid — update user and issue JWT ────────────────
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

    // Generate JWT (expires in 7 days)
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

// ----------------------------------------------------
// JWT Authentication Middleware
// ----------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// 4. COMMUNITY APIs
// ----------------------------------------------------

// GET /api/communities — list all communities (public)
app.get('/api/communities', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.name, c.description, c.emoji, c.tags, c.banner_color,
              c.member_count, c.online_count, c.created_at,
              u.username AS creator_name
       FROM communities c
       LEFT JOIN users u ON u.id = c.creator_id
       ORDER BY c.created_at DESC`
    );
    return res.status(200).json({ communities: result.rows });
  } catch (err) {
    console.error('Get communities error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch communities.' });
  }
});

// POST /api/communities — create a community (requires JWT)
app.post('/api/communities', authenticateToken, async (req, res) => {
  const { name, description, emoji, tags, banner_color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Community name is required.' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Community description is required.' });
  }

  const creatorId = req.user.id;
  const communityEmoji   = emoji        || '🌐';
  const communityTags    = tags         || '';
  const communityBanner  = banner_color || 'bg-code';

  try {
    // Check for duplicate name
    const dupCheck = await db.query('SELECT id FROM communities WHERE name ILIKE $1', [name.trim()]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A community with that name already exists.' });
    }

    const insertResult = await db.query(
      `INSERT INTO communities (name, description, emoji, tags, banner_color, creator_id, member_count, online_count)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 1)
       RETURNING *`,
      [name.trim(), description.trim(), communityEmoji, communityTags, communityBanner, creatorId]
    );

    const community = insertResult.rows[0];

    // Auto-join the creator as a member
    await db.query(
      'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [community.id, creatorId]
    );

    return res.status(201).json({ message: 'Community created successfully!', community });
  } catch (err) {
    console.error('Create community error:', err.message);
    return res.status(500).json({ error: 'Failed to create community.' });
  }
});

// POST /api/communities/:id/join — join a community (requires JWT)
app.post('/api/communities/:id/join', authenticateToken, async (req, res) => {
  const communityId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (isNaN(communityId)) {
    return res.status(400).json({ error: 'Invalid community ID.' });
  }

  try {
    // Verify community exists
    const commResult = await db.query('SELECT id, member_count FROM communities WHERE id = $1', [communityId]);
    if (commResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found.' });
    }

    // Insert membership (ignore if already a member)
    const insertRes = await db.query(
      'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [communityId, userId]
    );

    if (insertRes.rows.length === 0) {
      return res.status(200).json({ message: 'You are already a member of this community.' });
    }

    // Increment member count
    await db.query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [communityId]);

    return res.status(200).json({ message: 'Successfully joined the community!' });
  } catch (err) {
    console.error('Join community error:', err.message);
    return res.status(500).json({ error: 'Failed to join community.' });
  }
});

// ----------------------------------------------------
// 5. EMAIL INVITATION APIs
// ----------------------------------------------------

// ── Nodemailer transport (Gmail SMTP) ─────────────────────────────────────────
function createMailTransport() {
  const user = process.env.EMAIL_FROM;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass || pass === 'your_gmail_app_password_here') return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// ── HTML invite email builder ─────────────────────────────────────────────────
function buildInviteEmailHtml({ communityName, inviterName, inviteUrl, emoji }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to ${communityName} on ForgeAlly</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr><td style="background:linear-gradient(135deg,#0071e3 0%,#0a84ff 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:12px;">${emoji || '🌐'}</div>
            <h1 style="color:#ffffff;font-size:1.6rem;font-weight:700;margin:0;letter-spacing:-0.5px;">You're invited!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:0.95rem;">Join <strong>${communityName}</strong> on ForgeAlly</p>
          </td></tr>
          <!-- Body -->
          <tr><td style="padding:36px 40px;">
            <p style="color:#1d1d1f;font-size:1rem;line-height:1.6;margin:0 0 24px;">
              <strong>${inviterName}</strong> has invited you to join the <strong>${communityName}</strong> community on ForgeAlly — a peer communication platform built for creators, engineers, and communities.
            </p>
            <p style="color:#86868b;font-size:0.875rem;line-height:1.6;margin:0 0 32px;">
              Click the button below to accept your invitation. This link expires in <strong>7 days</strong>.
            </p>
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#0071e3 0%,#0a84ff 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:600;font-size:1rem;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(0,113,227,0.35);">Accept Invitation →</a>
            </div>
            <p style="color:#86868b;font-size:0.8rem;text-align:center;margin:0;">Or copy this link: <br><span style="color:#0071e3;word-break:break-all;">${inviteUrl}</span></p>
          </td></tr>
          <!-- Footer -->
          <tr><td style="background:#f5f5f7;padding:20px 40px;text-align:center;">
            <p style="color:#86868b;font-size:0.78rem;margin:0;">© 2026 ForgeAlly Inc. · If you didn't expect this email, you can safely ignore it.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
}

// POST /api/communities/:id/invite — send email invitations (requires JWT)
app.post('/api/communities/:id/invite', authenticateToken, async (req, res) => {
  const communityId = parseInt(req.params.id, 10);
  const { emails } = req.body; // Array of email strings
  const inviterId = req.user.id;

  if (isNaN(communityId)) {
    return res.status(400).json({ error: 'Invalid community ID.' });
  }
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'At least one email address is required.' });
  }
  if (emails.length > 10) {
    return res.status(400).json({ error: 'You can invite at most 10 people at once.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emails.filter(e => !emailRegex.test(e.trim()));
  if (invalidEmails.length > 0) {
    return res.status(400).json({ error: `Invalid email(s): ${invalidEmails.join(', ')}` });
  }

  try {
    // Verify community exists
    const commResult = await db.query(
      'SELECT c.id, c.name, c.emoji FROM communities c WHERE c.id = $1',
      [communityId]
    );
    if (commResult.rows.length === 0) {
      return res.status(404).json({ error: 'Community not found.' });
    }
    const community = commResult.rows[0];

    // Verify requester is a member
    const memberCheck = await db.query(
      'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
      [communityId, inviterId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member of this community to invite others.' });
    }

    // Get inviter's name
    const inviterResult = await db.query('SELECT username FROM users WHERE id = $1', [inviterId]);
    const inviterName = inviterResult.rows[0]?.username || 'A ForgeAlly member';

    const transport = createMailTransport();
    const APP_URL = process.env.APP_URL || 'http://localhost:3000';
    const results = [];

    for (const rawEmail of emails) {
      const email = rawEmail.trim().toLowerCase();
      try {
        // Generate unique secure token
        const token = crypto.randomBytes(48).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Upsert invitation — replace existing pending invite for same email+community
        await db.query(
          `INSERT INTO community_invitations (community_id, invited_email, invited_by, token, status, expires_at)
           VALUES ($1, $2, $3, $4, 'pending', $5)
           ON CONFLICT DO NOTHING`,
          [communityId, email, inviterId, token, expiresAt]
        );

        const inviteUrl = `${APP_URL}/api/invitations/accept?token=${token}`;

        if (transport) {
          await transport.sendMail({
            from: `"ForgeAlly" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `${inviterName} invited you to join ${community.name} on ForgeAlly`,
            html: buildInviteEmailHtml({
              communityName: community.name,
              inviterName,
              inviteUrl,
              emoji: community.emoji,
            }),
          });
          console.log(`✅ Invite email sent to ${email} for community ${community.name}`);
          results.push({ email, status: 'sent' });
        } else {
          // Dev fallback — log the link
          console.log(`\n--- [MOCK INVITE EMAIL — configure EMAIL_FROM and EMAIL_PASS in .env to send real emails] ---`);
          console.log(`To: ${email}`);
          console.log(`Community: ${community.name}`);
          console.log(`Accept Link: ${inviteUrl}`);
          console.log('------------------------------------------------------------------------------------\n');
          results.push({ email, status: 'sent', dev_link: inviteUrl });
        }
      } catch (emailErr) {
        console.error(`Failed to invite ${email}:`, emailErr.message);
        results.push({ email, status: 'failed', error: emailErr.message });
      }
    }

    return res.status(200).json({
      message: `Invitations processed for ${results.length} email(s).`,
      results,
      email_configured: !!transport,
    });
  } catch (err) {
    console.error('Invite error:', err.message);
    return res.status(500).json({ error: 'Failed to process invitations.' });
  }
});

// GET /api/invitations/accept?token=xxx — accept an invitation (no auth required)
app.get('/api/invitations/accept', async (req, res) => {
  const { token } = req.query;
  const APP_URL = process.env.APP_URL || 'http://localhost:3000';

  if (!token) {
    return res.redirect(`${APP_URL}/#community?error=missing_token`);
  }

  try {
    // Look up invitation
    const inviteResult = await db.query(
      `SELECT ci.*, c.name AS community_name, c.id AS comm_id
       FROM community_invitations ci
       JOIN communities c ON c.id = ci.community_id
       WHERE ci.token = $1 AND ci.status = 'pending' AND ci.expires_at > NOW()`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      // Token invalid or expired — redirect with error
      return res.redirect(`${APP_URL}/#community?invite_error=expired`);
    }

    const invite = inviteResult.rows[0];

    // Try to find an existing user with that email
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [invite.invited_email]
    );

    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      // Add membership
      const inserted = await db.query(
        'INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
        [invite.comm_id, userId]
      );
      if (inserted.rows.length > 0) {
        await db.query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [invite.comm_id]);
      }
    }

    // Mark invitation accepted
    await db.query(
      "UPDATE community_invitations SET status = 'accepted' WHERE token = $1",
      [token]
    );

    const communityName = encodeURIComponent(invite.community_name);
    return res.redirect(`${APP_URL}/#community?joined=${communityName}`);
  } catch (err) {
    console.error('Accept invite error:', err.message);
    return res.redirect(`${APP_URL}/#community?invite_error=server_error`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ForgeAlly server running on port ${PORT}`);
});
