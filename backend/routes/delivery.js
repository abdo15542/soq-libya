const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// الطلبات المتاحة في مدينة معينة
router.get('/available-orders/:city', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, u.full_name as seller_name, 
             u2.full_name as customer_name, p.city
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.seller_id = u.id
      JOIN users u2 ON o.customer_id = u2.id
      WHERE o.status = 'ready_for_pickup' AND p.city = $1
      ORDER BY o.created_at
    `, [req.params.city]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// قبول طلب
router.post('/accept-order', async (req, res) => {
  const { orderId, driverId } = req.body;
  try {
    await pool.query(
      'UPDATE orders SET status = $1, driver_id = $2 WHERE id = $3',
      ['in_delivery', driverId, orderId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// طلبات مندوب معين
router.get('/driver/:driverId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, 
             u.full_name as customer_name, u2.full_name as seller_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.customer_id = u.id
      JOIN users u2 ON o.seller_id = u2.id
      WHERE o.driver_id = $1 AND o.status IN ('in_delivery', 'delivered')
      ORDER BY o.created_at DESC
    `, [req.params.driverId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;