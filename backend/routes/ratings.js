const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.use(checkAuth);

router.post('/', async (req, res) => {
  const orderId = Number(req.body.orderId);
  const ratedUserId = Number(req.body.ratedUserId);
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';
  if (!Number.isSafeInteger(orderId) || orderId < 1 ||
      !Number.isSafeInteger(ratedUserId) || ratedUserId < 1 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'بيانات التقييم غير صحيحة' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT customer_id, seller_id, driver_id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'الطلب غير موجود' }); }
    const order = found.rows[0];
    if (order.status !== 'delivered') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'يمكن تقييم الطلب بعد اكتمال التوصيل فقط' }); }
    const participants = [order.customer_id, order.seller_id, order.driver_id].filter(v => v != null).map(Number);
    if (!participants.includes(Number(req.userId)) || !participants.includes(ratedUserId) || Number(req.userId) === ratedUserId) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'التقييم متاح لأطراف الطلب فقط' });
    }
    const exists = await client.query('SELECT id FROM ratings WHERE order_id = $1 AND rater_id = $2', [orderId, req.userId]);
    if (exists.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'سبق أن قيّمت هذا الطلب' }); }
    await client.query('INSERT INTO ratings (order_id, rater_id, rated_user_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [orderId, req.userId, ratedUserId, rating, comment]);
    const avg = await client.query('SELECT AVG(rating) AS avg FROM ratings WHERE rated_user_id = $1', [ratedUserId]);
    await client.query('UPDATE users SET rating = $1 WHERE id = $2', [avg.rows[0].avg || 5, ratedUserId]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Rating submission failed:', error);
    return res.status(500).json({ error: 'تعذر حفظ التقييم' });
  } finally { client.release(); }
});

module.exports = router;
