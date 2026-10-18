const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Transitional guard: roles are loaded from PostgreSQL, never trusted from client headers.
// NOTE: x-user-id is still not a secure identity proof. Replace with verified JWT/session
// before public production launch; this guard only prevents role spoofing via x-user-role.
const checkAuth = async (req, res, next) => {
  const rawUserId = req.headers['x-user-id'];
  const userId = Number(rawUserId);
  if (!rawUserId || !Number.isSafeInteger(userId) || userId < 1) {
    return res.status(401).json({ error: 'غير مصرح، الرجاء تسجيل الدخول' });
  }

  try {
    const result = await pool.query(
      'SELECT id, role, verified FROM users WHERE id = $1',
      [userId]
    );
    if (!result.rowCount) {
      return res.status(401).json({ error: 'الحساب غير موجود أو انتهت الجلسة' });
    }
    req.user = result.rows[0];
    req.userId = result.rows[0].id;
    req.userRole = result.rows[0].role || 'customer';
    return next();
  } catch (error) {
    console.error('Authentication lookup failed:', error);
    return res.status(503).json({ error: 'تعذر التحقق من الحساب حاليًا' });
  }
};

const checkRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.userRole)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
  }
  return next();
};

module.exports = { checkAuth, checkRole };
