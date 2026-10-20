const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.use(checkAuth);

router.get('/:orderId', async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'رقم الطلب غير صحيح' });
  }
  try {
    const order = await pool.query(
      'SELECT customer_id, seller_id, driver_id FROM orders WHERE id = $1',
      [orderId]
    );
    if (!order.rowCount) return res.status(404).json({ error: 'الطلب غير موجود' });
    const o = order.rows[0];
    const allowed = req.userRole === 'admin' ||
      Number(o.customer_id) === Number(req.userId) ||
      Number(o.seller_id) === Number(req.userId) ||
      (o.driver_id != null && Number(o.driver_id) === Number(req.userId));
    if (!allowed) return res.status(403).json({ error: 'المحادثة مخصصة للمشاركين في الطلب فقط' });

    const result = await pool.query(`
      SELECT c.id, c.order_id, c.sender_id, c.message, c.sent_at, u.full_name as sender_name
      FROM chats c
      JOIN users u ON c.sender_id = u.id
      WHERE c.order_id = $1
      ORDER BY c.sent_at ASC
      LIMIT 500
    `, [orderId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Chat history lookup failed:', error);
    return res.status(500).json({ error: 'تعذر جلب المحادثة' });
  }
});

module.exports = router;
