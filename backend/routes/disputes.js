const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.post('/', async (req, res) => {
  const { orderId, customerId, reason } = req.body;
  try {
    await pool.query(
      'INSERT INTO disputes (order_id, customer_id, reason) VALUES ($1, $2, $3)',
      [orderId, customerId, reason]
    );
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['disputed', orderId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;