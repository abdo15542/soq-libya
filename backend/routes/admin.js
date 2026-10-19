const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { checkAuth, checkRole } = require('../middleware/auth');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// استخدام صلاحية admin فقط
router.use(checkAuth);
router.use(checkRole(['admin']));

// إحصائيات
router.get('/stats', async (req, res) => {
  try {
    const orders = await pool.query('SELECT COUNT(*) as total, SUM(total_amount) as revenue FROM orders');
    const profit = await pool.query(`SELECT SUM(o.total_amount * 0.10) as profit FROM orders o WHERE o.status = 'delivered'`);
    const pending = await pool.query(`SELECT SUM(total_amount * 0.90) as pending FROM orders WHERE status = 'delivered' AND paid_to_seller = FALSE`);
    const activeUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE verified = TRUE');
    
    res.json({
      totalOrders: parseInt(orders.rows[0].total) || 0,
      totalRevenue: parseFloat(orders.rows[0].revenue) || 0,
      platformProfit: parseFloat(profit.rows[0].profit) || 0,
      pendingPayouts: parseFloat(pending.rows[0].pending) || 0,
      activeUsers: parseInt(activeUsers.rows[0].count) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// قائمة البائعين
router.get('/sellers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.role, u.verified, u.rating, u.created_at, COALESCE(SUM(o.total_amount), 0) as total_sales
      FROM users u
      LEFT JOIN orders o ON u.id = o.seller_id AND o.status = 'delivered'
      WHERE u.role = 'seller'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// قائمة المندوبين
router.get('/drivers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.role, u.verified, u.rating, u.created_at, COUNT(o.id) as total_deliveries
      FROM users u
      LEFT JOIN orders o ON u.id = o.driver_id AND o.status = 'delivered'
      WHERE u.role = 'driver'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// طلبات توثيق الحسابات وصلاحيات البائع/المندوب
router.get('/verification-requests', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, requested_role, verified, id_image, selfie_image, created_at FROM users WHERE requested_role IN ('seller', 'driver') AND id_image IS NOT NULL AND selfie_image IS NOT NULL ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (error) { console.error('Verification request listing failed:', error); res.status(500).json({ error: 'تعذر جلب طلبات التوثيق' }); }
});

router.put('/users/:userId/approve-role', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ error: 'معرّف الحساب غير صحيح' });
  try {
    const result = await pool.query(
      "UPDATE users SET role = requested_role, verified = TRUE, requested_role = NULL WHERE id = $1 AND requested_role IN ('seller', 'driver') AND id_image IS NOT NULL AND selfie_image IS NOT NULL RETURNING id, role, verified",
      [userId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'طلب التوثيق غير موجود أو غير مكتمل' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) { console.error('Role approval failed:', error); res.status(500).json({ error: 'تعذر اعتماد طلب الحساب' }); }
});

// النزاعات المفتوحة
router.get('/disputes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, o.total_amount as order_total, u1.full_name as customer_name, u2.full_name as seller_name
      FROM disputes d
      JOIN orders o ON d.order_id = o.id
      JOIN users u1 ON d.customer_id = u1.id
      JOIN users u2 ON o.seller_id = u2.id
      WHERE d.status = 'open'
      ORDER BY d.created_at
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// توثيق/إلغاء توثيق مستخدم
router.put('/users/:userId/verify', async (req, res) => {
  const { verified } = req.body;
  try {
    await pool.query('UPDATE users SET verified = $1 WHERE id = $2', [verified, req.params.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// حل نزاع
router.put('/disputes/:disputeId/resolve', async (req, res) => {
  const { resolution, refundAmount } = req.body;
  try {
    await pool.query(
      'UPDATE disputes SET status = $1, resolution = $2 WHERE id = $3',
      ['resolved', resolution, req.params.disputeId]
    );
    
    if (resolution === 'refund') {
      const dispute = await pool.query('SELECT order_id FROM disputes WHERE id = $1', [req.params.disputeId]);
      await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['refunded', dispute.rows[0].order_id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;