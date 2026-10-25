const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.use(checkAuth);

router.post('/', async (req, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ error: 'فتح النزاعات متاح لحساب المشتري فقط' });
  }
  const orderId = Number(req.body.orderId);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!Number.isSafeInteger(orderId) || orderId < 1 || reason.length < 5 || reason.length > 2000) {
    return res.status(400).json({ error: 'يرجى إدخال رقم طلب وسبب واضح للنزاع' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const order = await client.query('SELECT id, customer_id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!order.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'الطلب غير موجود' }); }
    if (Number(order.rows[0].customer_id) !== Number(req.userId)) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'يمكن لزبون الطلب فقط فتح النزاع' });
    }
    const disputeEligibleStatuses = ['pending', 'ready_for_pickup', 'in_delivery', 'delivered'];
    if (!disputeEligibleStatuses.includes(order.rows[0].status)) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'لا يمكن فتح نزاع في حالة الطلب الحالية' });
    }
    const existing = await client.query("SELECT id FROM disputes WHERE order_id = $1 AND status = 'open'", [orderId]);
    if (existing.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'يوجد نزاع مفتوح لهذا الطلب بالفعل' }); }
    const created = await client.query('INSERT INTO disputes (order_id, customer_id, reason, order_status_before_dispute) VALUES ($1, $2, $3, $4) RETURNING id, order_id, customer_id, reason, status, created_at', [orderId, req.userId, reason, order.rows[0].status]);
    await client.query("UPDATE orders SET status = 'disputed' WHERE id = $1", [orderId]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, dispute: created.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Dispute creation failed:', error);
    return res.status(500).json({ error: 'تعذر فتح النزاع' });
  } finally { if (client) client.release(); }
});

module.exports = router;
