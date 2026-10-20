const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.use(checkAuth);

// عرض الطلبات الجاهزة للمندوبين المعتمدين فقط.
router.get('/available-orders/:city', async (req, res) => {
  if (req.userRole !== 'driver' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'هذه الخدمة للمندوبين فقط' });
  }
  const city = String(req.params.city || '').trim();
  if (!city || city.length > 50) return res.status(400).json({ error: 'المدينة غير صحيحة' });
  try {
    if (req.userRole === 'driver') {
      const verification = await pool.query('SELECT verified FROM users WHERE id = $1 AND role = $2', [req.userId, 'driver']);
      if (!verification.rowCount || verification.rows[0].verified !== true) {
        return res.status(403).json({ error: 'يجب توثيق حساب المندوب قبل عرض طلبات التوصيل' });
      }
    }
    const result = await pool.query(`
      SELECT o.id, o.status, o.total_amount, o.delivery_fee, o.created_at,
             p.name AS product_name, p.city, u.full_name AS seller_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.seller_id = u.id
      WHERE o.status = 'ready_for_pickup' AND o.driver_id IS NULL AND p.city = $1
      ORDER BY o.created_at ASC
      LIMIT 100
    `, [city]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Available delivery orders failed:', error);
    return res.status(500).json({ error: 'تعذر جلب طلبات التوصيل' });
  }
});

// إسناد ذري للطلب إلى المندوب الحالي، لا إلى رقم يرسله العميل.
router.post('/accept-order', async (req, res) => {
  if (req.userRole !== 'driver') return res.status(403).json({ error: 'حساب المندوب مطلوب' });
  const orderId = Number(req.body.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'رقم الطلب غير صحيح' });
  }
  try {
    const result = await pool.query(
      `UPDATE orders
       SET status = 'in_delivery', driver_id = $1
       WHERE id = $2 AND status = 'ready_for_pickup' AND driver_id IS NULL
         AND EXISTS (SELECT 1 FROM users WHERE id = $1 AND role = 'driver' AND verified = TRUE)
       RETURNING id, status, driver_id, customer_id, seller_id, product_id, total_amount, delivery_fee`,
      [req.userId, orderId]
    );
    if (!result.rowCount) {
      return res.status(409).json({ error: 'الطلب لم يعد متاحًا أو تم استلامه من مندوب آخر' });
    }
    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Accept delivery order failed:', error);
    return res.status(500).json({ error: 'تعذر قبول الطلب' });
  }
});

// لا يمكن للمندوب عرض مهام مندوب آخر بتغيير المعرف في الرابط.
router.get('/driver/:driverId', async (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isSafeInteger(driverId) || driverId < 1) return res.status(400).json({ error: 'رقم المندوب غير صحيح' });
  if (req.userRole !== 'admin' &&
      (req.userRole !== 'driver' || driverId !== Number(req.userId))) {
    return res.status(403).json({ error: 'غير مصرح بعرض طلبات هذا المندوب' });
  }
  try {
    const result = await pool.query(`
      SELECT o.id, o.status, o.total_amount, o.delivery_fee, o.customer_address,
             o.created_at, o.delivered_at, p.name AS product_name,
             u.full_name AS customer_name, u2.full_name AS seller_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.customer_id = u.id
      JOIN users u2 ON o.seller_id = u2.id
      WHERE o.driver_id = $1 AND o.status IN ('in_delivery', 'delivered')
      ORDER BY o.created_at DESC
      LIMIT 200
    `, [driverId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Driver orders lookup failed:', error);
    return res.status(500).json({ error: 'تعذر جلب طلبات المندوب' });
  }
});

module.exports = router;
