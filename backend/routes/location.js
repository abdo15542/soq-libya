const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

// تحديث موقع المندوب
router.post('/driver', async (req, res) => {
  const { driverId, latitude, longitude } = req.body;
  try {
    await pool.query(
      `INSERT INTO driver_locations (driver_id, latitude, longitude, updated_at) 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT (driver_id) DO UPDATE SET 
         latitude = EXCLUDED.latitude, 
         longitude = EXCLUDED.longitude, 
         updated_at = NOW()`,
      [driverId, latitude, longitude]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// الحصول على موقع مندوب
router.get('/driver/:driverId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT latitude, longitude, updated_at FROM driver_locations WHERE driver_id = $1',
      [req.params.driverId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;