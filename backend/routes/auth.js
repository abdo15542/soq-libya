const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const { encrypt, decrypt } = require('../utils/crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// تسجيل/دخول برقم الهاتف
// توحيد رقم الهاتف الليبي قبل التحقق والتخزين
const normalizeLibyanPhone = (value) => {
  let phone = String(value || '').replace(/[\s().-]/g, '');
  if (phone.startsWith('+218')) phone = '0' + phone.slice(4);
  else if (phone.startsWith('218')) phone = '0' + phone.slice(3);
  return phone;
};

router.post('/phone', async (req, res) => {
  const phone = normalizeLibyanPhone(req.body.phone);
  // أرقام المحمول الليبية المحلية: 09xxxxxxxx أو 091/092/094/095/096/.... ضمن 10 أرقام
  if (!/^09\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'أدخل رقم هاتف ليبي صحيحًا مثل 0912345678', code: 'INVALID_PHONE' });
  }

  try {
    // التشفير يستخدم IV عشوائيًا، لذلك لا يمكن البحث بمقارنة النص المشفر.
    // نفك تشفير الأرقام الموجودة ونقارن الرقم الموحّد لتفادي إنشاء حساب جديد في كل محاولة.
    const existing = await pool.query('SELECT * FROM users ORDER BY id ASC');
    let user = null;
    for (const row of existing.rows) {
      try {
        if (normalizeLibyanPhone(decrypt(row.phone)) === phone) {
          user = row;
          break;
        }
      } catch (decryptError) {
        // تجاهل السجل غير القابل لفك التشفير؛ لا نعرض بياناته للعميل.
      }
    }

    if (!user) {
      const inserted = await pool.query(
        'INSERT INTO users (phone, role, verified) VALUES ($1, $2, FALSE) RETURNING *',
        [encrypt(phone), 'customer']
      );
      user = inserted.rows[0];
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        phone,
        full_name: user.full_name,
        role: user.role || 'customer',
        verified: Boolean(user.verified),
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Phone sign-in failed:', error);
    res.status(500).json({ error: 'تعذر إكمال تسجيل الدخول حاليًا', code: 'AUTH_SERVER_ERROR' });
  }
});

// استلام طلب التوثيق: لا يُعتبر الحساب موثقًا تلقائيًا عند رفع الصور.
// يلزم فحص الوثائق واعتمادها من الإدارة قبل تفعيل صلاحيات البيع أو التوصيل.
router.post('/verify', async (req, res) => {
  const { userId, idImage, selfieImage, fullName, role } = req.body;
  const id = Number(userId);
  const allowedRoles = ['customer', 'seller', 'driver'];
  if (!Number.isSafeInteger(id) || id < 1 ||
      typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100 ||
      typeof idImage !== 'string' || idImage.length < 20 || idImage.length > 5_000_000 ||
      typeof selfieImage !== 'string' || selfieImage.length < 20 || selfieImage.length > 5_000_000 ||
      !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'بيانات التوثيق غير مكتملة أو غير صحيحة' });
  }

  try {
    const existing = await pool.query('SELECT id, verified FROM users WHERE id = $1', [id]);
    if (!existing.rowCount) return res.status(404).json({ error: 'الحساب غير موجود' });

    // Store the requested role only as a pending request would require a separate schema;
    // therefore only customer role is kept until admin approval.
    await pool.query(
      'UPDATE users SET id_image = $1, selfie_image = $2, full_name = $3, role = $4, verified = FALSE WHERE id = $5',
      [idImage, selfieImage, fullName.trim(), 'customer', id]
    );
    return res.status(202).json({
      success: true,
      pendingReview: true,
      message: 'تم استلام طلب التوثيق وهو بانتظار مراجعة الإدارة'
    });
  } catch (error) {
    console.error('Verification submission failed:', error);
    return res.status(500).json({ error: 'تعذر حفظ طلب التوثيق حاليًا' });
  }
});

// جلب بيانات المستخدم
router.get('/me/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, phone, full_name, role, verified, rating FROM users WHERE id = $1', [req.params.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const user = result.rows[0];
    user.phone = decrypt(user.phone);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// لا يوجد endpoint عام لتغيير الدور؛ التغيير الإداري يجب أن يمر عبر مسار إدارة محمي.

module.exports = router;
