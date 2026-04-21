const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const { encrypt, decrypt } = require('../utils/crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// تسجيل/دخول برقم الهاتف
router.post('/phone',
  body('phone').isMobilePhone('ar-LY').withMessage('رقم هاتف ليبي غير صالح'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { phone } = req.body;
    try {
      const encryptedPhone = encrypt(phone);
      let result = await pool.query('SELECT * FROM users WHERE phone = $1', [encryptedPhone]);
      
      if (result.rows.length === 0) {
        result = await pool.query(
          'INSERT INTO users (phone) VALUES ($1) RETURNING *',
          [encryptedPhone]
        );
      }
      
      const user = result.rows[0];
      res.json({ 
        success: true, 
        user: { 
          ...user, 
          phone: decrypt(user.phone) // نعيد الرقم الأصلي للاستجابة فقط
        } 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

// توثيق الحساب (رفع الوثائق والسيلفي)
router.post('/verify', async (req, res) => {
  const { userId, idImage, selfieImage, fullName, role } = req.body;
  try {
    await pool.query(
      'UPDATE users SET id_image = $1, selfie_image = $2, full_name = $3, role = $4, verified = TRUE WHERE id = $5',
      [idImage, selfieImage, fullName, role, userId]
    );
    res.json({ success: true, message: 'تم توثيق الحساب بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// تغيير الدور (للمستخدمين غير الموثقين)
router.put('/role/:userId', async (req, res) => {
  const { role } = req.body;
  try {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
