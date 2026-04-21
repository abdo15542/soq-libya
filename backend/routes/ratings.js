const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

router.post('/', async (req, res) => {
  const { orderId, raterId, ratedUserId, rating, comment } = req.body;
  try {
    await pool.query(
      'INSERT INTO ratings (order_id, rater_id, rated_user_id, rating, comment) VALUES ($1, $2, $3, $4, $5)',
      [orderId, raterId, ratedUserId, rating, comment]
    );
    // تحديث متوسط التقييم
    const avg = await pool.query('SELECT AVG(rating) as avg FROM ratings WHERE rated_user_id = $1', [ratedUserId]);
    await pool.query('UPDATE users SET rating = $1 WHERE id = $2', [avg.rows[0].avg || 5.0, ratedUserId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;