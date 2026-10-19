const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { decrypt } = require('../utils/crypto');
const { checkAuth } = require('../middleware/auth');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const googleClient = new OAuth2Client();
function publicUser(user) { let phone = null; if (user.phone) { try { phone = decrypt(user.phone); } catch { phone = null; } } return { id: Number(user.id), email: user.email || null, full_name: user.full_name || null, phone, role: user.role || 'customer', verified: Boolean(user.verified), rating: user.rating }; }
function issueSession(user) { if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters'); return jwt.sign({ sub: String(user.id), typ: 'access' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h', issuer: 'soq-libya-api', audience: 'soq-libya-client' }); }
router.post('/google', async (req, res) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential || credential.length > 10000) return res.status(400).json({ error: 'تعذر قراءة بيانات تسجيل Google', code: 'INVALID_CREDENTIAL' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'تسجيل Google غير مهيأ على الخادم', code: 'GOOGLE_AUTH_NOT_CONFIGURED' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ error: 'جلسات الدخول غير مهيأة بأمان على الخادم', code: 'SESSION_NOT_CONFIGURED' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const claims = ticket.getPayload();
    if (!claims?.sub || !claims.email || claims.email_verified !== true) return res.status(401).json({ error: 'يلزم حساب Google ببريد إلكتروني موثق', code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    const result = await pool.query(
      'INSERT INTO users (google_sub, email, full_name, role, verified) VALUES ($1, $2, $3, \'customer\', FALSE) ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(users.full_name, EXCLUDED.full_name) RETURNING id, email, phone, full_name, role, verified, rating',
      [claims.sub, claims.email.toLowerCase(), typeof claims.name === 'string' ? claims.name.slice(0, 100) : null]
    );
    const user = result.rows[0];
    return res.json({ success: true, token: issueSession(user), expiresIn: 43200, user: publicUser(user) });
  } catch (error) { console.error('Google sign-in failed:', error); return res.status(500).json({ error: 'تعذر إكمال تسجيل الدخول حاليًا', code: 'AUTH_SERVER_ERROR' }); }
});
router.get('/me', checkAuth, async (req, res) => {
  try { const result = await pool.query('SELECT id, email, phone, full_name, role, verified, rating FROM users WHERE id = $1', [req.userId]); if (!result.rowCount) return res.status(404).json({ error: 'المستخدم غير موجود' }); return res.json(publicUser(result.rows[0])); }
  catch (error) { console.error('Profile lookup failed:', error); return res.status(500).json({ error: 'تعذر جلب بيانات الحساب حاليًا' }); }
});
router.post('/verify', checkAuth, async (req, res) => {
  const { idImage, selfieImage, fullName, requestedRole } = req.body || {};
  const allowedRequestedRoles = ['customer', 'seller', 'driver'];
  if (!allowedRequestedRoles.includes(requestedRole)) return res.status(400).json({ error: 'نوع الحساب المطلوب غير صحيح' });
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100 || typeof idImage !== 'string' || idImage.length < 20 || idImage.length > 5000000 || typeof selfieImage !== 'string' || selfieImage.length < 20 || selfieImage.length > 5000000) return res.status(400).json({ error: 'بيانات التوثيق غير مكتملة أو غير صحيحة' });
  try { const result = await pool.query('UPDATE users SET id_image = $1, selfie_image = $2, full_name = $3, requested_role = $4, verified = FALSE WHERE id = $5 RETURNING id', [idImage, selfieImage, fullName.trim(), requestedRole, req.userId]); if (!result.rowCount) return res.status(404).json({ error: 'الحساب غير موجود' }); return res.status(202).json({ success: true, pendingReview: true, message: 'تم استلام طلب التوثيق وهو بانتظار مراجعة الإدارة' }); }
  catch (error) { console.error('Verification submission failed:', error); return res.status(500).json({ error: 'تعذر حفظ طلب التوثيق حاليًا' }); }
});
module.exports = router;
