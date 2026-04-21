const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.get('/:orderId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.full_name as sender_name
      FROM chats c
      JOIN users u ON c.sender_id = u.id
      WHERE c.order_id = $1
      ORDER BY c.sent_at
    `, [req.params.orderId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;