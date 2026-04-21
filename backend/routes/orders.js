const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// إنشاء طلب جديد
router.post('/', async (req, res) => {
  const { customerId, sellerId, productId, totalAmount, deliveryFee, customerAddress } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO orders (customer_id, seller_id, product_id, total_amount, delivery_fee, customer_address, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [customerId, sellerId, productId, totalAmount, deliveryFee, customerAddress]
    );
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// طلبات الزبون
router.get('/customer/:customerId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, p.images as product_images,
             u.full_name as seller_name, d.full_name as driver_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.seller_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE o.customer_id = $1
      ORDER BY o.created_at DESC
    `, [req.params.customerId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// طلبات البائع
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, p.name as product_name, p.images as product_images,
             u.full_name as customer_name
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.customer_id = u.id
      WHERE o.seller_id = $1
      ORDER BY o.created_at DESC
    `, [req.params.sellerId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تحديث حالة الطلب
router.put('/:orderId/status', async (req, res) => {
  const { status, driverId } = req.body;
  try {
    if (status === 'ready_for_pickup') {
      await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.orderId]);
    } else if (status === 'in_delivery') {
      await pool.query('UPDATE orders SET status = $1, driver_id = $2 WHERE id = $3', [status, driverId, req.params.orderId]);
    } else if (status === 'delivered') {
      await pool.query('UPDATE orders SET status = $1, delivered_at = NOW() WHERE id = $2', [status, req.params.orderId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;