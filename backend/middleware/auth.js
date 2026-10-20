const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
const checkAuth = async (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'انتهت الجلسة أو لم تسجل الدخول، يرجى تسجيل الدخول مجددًا' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ error: 'خدمة الجلسات غير مهيأة بأمان' });
  let claims;
  try { claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'soq-libya-api', audience: 'soq-libya-client' }); }
  catch { return res.status(401).json({ error: 'الجلسة غير صالحة أو انتهت، يرجى تسجيل الدخول مجددًا' }); }
  const userId = Number(claims.sub);
  if (claims.typ !== 'access' || !Number.isSafeInteger(userId) || userId < 1) return res.status(401).json({ error: 'الجلسة غير صالحة' });
  try { const result = await pool.query('SELECT id, role, verified FROM users WHERE id = $1', [userId]); if (!result.rowCount) return res.status(401).json({ error: 'الحساب غير موجود أو انتهت الجلسة' }); req.user = result.rows[0]; req.userId = Number(result.rows[0].id); req.userRole = result.rows[0].role || 'customer'; return next(); }
  catch (error) { console.error('Authentication lookup failed:', error); return res.status(503).json({ error: 'تعذر التحقق من الحساب حاليًا' }); }
};
const checkRole = (roles) => (req, res, next) => { if (!req.user || !roles.includes(req.userRole)) return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' }); return next(); };
module.exports = { checkAuth, checkRole };
